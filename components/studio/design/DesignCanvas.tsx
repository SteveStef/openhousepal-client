'use client'

import { Fragment, memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { styledQrSvg } from '@/lib/qrStyle'
import { Home } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { BrandKit, DesignBlock, DesignBlockStyle, DesignColorMode, DesignFormatDef, DesignStyleId, DesignTemplateLayoutHints, LinkedProperty } from '@/types'
import { DEFAULT_FACT_FIELDS } from '@/lib/studio/designFormats'
import { DesignTheme, resolveDesignTheme } from '@/lib/studio/designTheme'
import { DESIGN_FONTS } from '@/lib/studio/designFonts'
import { compositionFromLegacy, DesignCompositionId, DesignFamily, formatFamily } from '@/lib/studio/designCompositions'
import { getSituation } from '@/lib/studio/designSituations'

export interface DesignCanvasContext {
  format: DesignFormatDef
  styleId: DesignStyleId
  colorMode: DesignColorMode
  // Legacy: layout hints from a pre-composition template id. Only consulted when `composition` is
  // absent (see compositionFromLegacy), so old saved designs keep their general arrangement.
  layoutHints?: DesignTemplateLayoutHints
  // The template's art direction (lib/studio/designTemplates.ts). Resolved by the caller from the
  // design's template_id via getTemplate(...).composition.
  composition?: DesignCompositionId | null
  // The design's situation (just_listed, open_house, home_valuation...) - drives situation-aware
  // details like the price label, the price-improvement "was" line and the fine print.
  situation?: string | null
  property: LinkedProperty | null
  agentName: string
  agentBrokerage?: string | null
  agentPhotoUrl?: string | null
  agentPhotoPosition?: { x: number; y: number } | null
  agentTitle?: string | null
  agentPhone?: string | null
  agentOfficePhone?: string | null
  agentEmail?: string | null
  brandKit: BrandKit | null
  agentHubSlug?: string | null
  brandingMode: 'personal' | 'team' | 'brokerage' | 'none'
  // Resolved by the editor (not fetched here - DesignCanvas stays a pure function of ctx+blocks):
  // the linked open house's public sign-in path, e.g. `/open-house/{id}`, for QR "property"/
  // "open_house_registration" targets, and the agent's buyer/seller form slugs for the QR
  // "buyer_form"/"seller_form" targets.
  linkedOpenHouseFormUrl?: string | null
  buyerFormSlug?: string | null
  sellerFormSlug?: string | null
  // The full, already-tokenized tracking link for the design's attached Form Campaign, if any -
  // once set, this is the QR's destination regardless of the block's own `data.target`.
  campaignUrl?: string | null
}

interface DesignCanvasProps {
  blocks: DesignBlock[]
  ctx: DesignCanvasContext
  exportRef?: React.RefObject<HTMLDivElement | null>
  selectedBlockId?: string | null
  onSelectBlock?: (blockId: string) => void
}

export interface CollagePhoto { src: string; style: CSSProperties }

// ---------------------------------------------------------------------------------------------
// Units. Everything on the canvas is sized in `cqmin` - a percentage of the canvas's SHORT side -
// so one design renders identically as a 120px wizard thumbnail, in the editor, in the 1200px
// client export, and in the headless 300-DPI print render, and type scales sensibly across very
// different aspect ratios (a 9:16 story and a 3:1 email banner share the same scale logic).
// ---------------------------------------------------------------------------------------------
const u = (n: number) => `${Math.round(n * 1000) / 1000}cqmin`
const hair = 'max(1px, 0.14cqmin)'

interface Sizes { kicker: number; title: number; big: number; sub: number; price: number; facts: number; body: number; agentName: number; agentMeta: number; headshot: number; qr: number; gap: number; pad: number; fine: number }

const BASE_SIZES: Record<DesignFamily, Sizes> = {
  square: { kicker: 2.3, title: 6.6, big: 13.5, sub: 2.15, price: 4.4, facts: 2.15, body: 2.1, agentName: 2.35, agentMeta: 1.75, headshot: 7.6, qr: 12, gap: 2.2, pad: 6.5, fine: 1.35 },
  story: { kicker: 3.4, title: 9.8, big: 19, sub: 3.2, price: 6.4, facts: 3.2, body: 3.3, agentName: 3.6, agentMeta: 2.7, headshot: 11.5, qr: 18, gap: 3.3, pad: 8, fine: 2 },
  portrait: { kicker: 2.3, title: 6.4, big: 12.5, sub: 2.05, price: 4.5, facts: 2.1, body: 1.95, agentName: 2.4, agentMeta: 1.75, headshot: 8, qr: 11.5, gap: 2, pad: 6, fine: 1.3 },
  tall: { kicker: 4.4, title: 10.8, big: 19, sub: 3.8, price: 8.2, facts: 4, body: 3.7, agentName: 4.5, agentMeta: 3.3, headshot: 14, qr: 22, gap: 3.8, pad: 9, fine: 2.5 },
  landscape: { kicker: 3.4, title: 9.4, big: 17, sub: 3.1, price: 6.4, facts: 3.1, body: 3, agentName: 3.4, agentMeta: 2.6, headshot: 11, qr: 17, gap: 3.2, pad: 8, fine: 1.95 },
  banner: { kicker: 5.4, title: 14, big: 25, sub: 4.7, price: 9.4, facts: 4.7, body: 4.4, agentName: 5.4, agentMeta: 4.1, headshot: 18, qr: 26, gap: 4.6, pad: 10, fine: 3 },
}

function scaled(s: Sizes, k: number): Sizes {
  const out = { ...s }
  for (const key of Object.keys(out) as (keyof Sizes)[]) {
    if (key !== 'pad') out[key] = s[key] * k
  }
  return out
}

// Long addresses/headlines shrink to fit instead of wrapping into 4 lines - no measuring needed,
// so it behaves identically in SSR-free thumbnails, the editor and the headless export.
function fit(text: string, base: number, comfortableChars: number, floor = 0.62): number {
  const len = (text || '').length
  if (len <= comfortableChars) return base
  return base * Math.max(floor, comfortableChars / len)
}

// ---------------------------------------------------------------------------------------------
// Content - blocks + property + agent resolved into one normalized view every composition reads.
// ---------------------------------------------------------------------------------------------
function fieldValue(block: DesignBlock, key: string, fallback: any) {
  if (block.overrides && block.overrides[key] !== undefined && block.overrides[key] !== '') return block.overrides[key]
  return fallback
}

const SIZE_SCALE: Record<string, number> = { sm: 0.8, md: 1, lg: 1.25, xl: 1.6 }

interface TextOverride { k: number; css: CSSProperties }

function textOverride(style: DesignBlockStyle | null | undefined, brandKit: BrandKit | null): TextOverride {
  if (!style) return { k: 1, css: {} }
  const css: CSSProperties = {}
  if (style.font === 'serif') css.fontFamily = DESIGN_FONTS.playfair
  if (style.font === 'sans') css.fontFamily = DESIGN_FONTS.inter
  if (style.font === 'mono') css.fontFamily = '"IBM Plex Mono", ui-monospace, monospace'
  if (style.bold !== undefined && style.bold !== null) css.fontWeight = style.bold ? 800 : 400
  if (style.align) css.textAlign = style.align
  if (style.uppercase) css.textTransform = 'uppercase'
  if (style.line_height === 'tight') css.lineHeight = 1.02
  if (style.line_height === 'relaxed') css.lineHeight = 1.55
  const c = style.color
  if (c) {
    css.color = c === 'primary' ? (brandKit?.primary_color || '#111827')
      : c === 'secondary' ? (brandKit?.secondary_color || '#C9A24D')
      : c === 'accent' ? (brandKit?.accent_color || '#816937')
      : c === 'white' ? '#ffffff' : c === 'black' ? '#111827' : c
  }
  return { k: (style.size && SIZE_SCALE[style.size]) || 1, css }
}

interface FactItem { key: string; value: string; label: string }

function factItem(key: string, raw: any): FactItem | null {
  if (raw === undefined || raw === null || raw === '') return null
  const num = Number(String(raw).replace(/,/g, ''))
  const isNum = !Number.isNaN(num) && String(raw).trim() !== ''
  switch (key) {
    case 'beds': return { key, value: String(raw), label: isNum && num === 1 ? 'Bed' : 'Beds' }
    case 'baths': return { key, value: String(raw), label: isNum && num === 1 ? 'Bath' : 'Baths' }
    case 'sqft': return { key, value: isNum ? num.toLocaleString('en-US') : String(raw), label: 'Sq Ft' }
    case 'lot_size':
      if (isNum && num >= 21780) return { key, value: (num / 43560).toFixed(2).replace(/\.?0+$/, ''), label: 'Acres' }
      return { key, value: isNum ? num.toLocaleString('en-US') : String(raw), label: 'Sq Ft Lot' }
    case 'year_built': return { key, value: String(raw), label: 'Built' }
    case 'property_type': return { key, value: String(raw), label: 'Type' }
    default: return { key, value: String(raw), label: key }
  }
}

function formatMoney(raw: any): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  const num = Number(String(raw).replace(/[$,\s]/g, ''))
  if (Number.isNaN(num)) return String(raw)
  if (num <= 0) return null
  return `$${num.toLocaleString('en-US')}`
}

// "6107817003" / "610-781-7003" / "+1 610.781.7003" -> "(610) 781-7003". Anything that isn't a
// 10-digit US number is left exactly as typed.
function formatPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return (raw || '').trim()
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

const PRICE_LABELS: Record<string, string> = {
  just_listed: 'Offered at', coming_soon: 'Anticipated at', open_house: 'Offered at', price_improvement: 'New Price',
  under_contract: 'Offered at', just_sold: 'Sold for', // only when a real sale price exists - see buildContent
}

type DetailItem =
  | { kind: 'facts'; id: string; items: FactItem[]; o: TextOverride }
  | { kind: 'openHouse'; id: string; date: string; time: string; o: TextOverride }
  | { kind: 'description'; id: string; text: string; o: TextOverride }
  | { kind: 'highlights'; id: string; items: string[]; o: TextOverride }
  | { kind: 'cta'; id: string; label: string; o: TextOverride }

interface PhotoRef { src: string; x: number; y: number; zoom: number; fit?: boolean }

interface Content {
  leadGen: boolean
  situation: string | null
  kicker: { id?: string; text: string; o: TextOverride } | null
  big: { id?: string; text: string; o: TextOverride } | null // statement headline for property designs
  title: { id?: string; text: string; o: TextOverride; placeholder: boolean; isAddress: boolean } | null
  sub: { id?: string; text: string } | null
  price: { id: string; value: string; label: string; previous: string | null; o: TextOverride } | null
  details: DetailItem[]
  qr: { id: string; url: string; label: string } | null
  agent: { id: string; name: string; title: string; brokerage: string; phone: string; office: string; email: string; website: string; photo: string | null; pos: { x: number; y: number } | null } | null
  logo: string | null
  logoScale: number
  photos: PhotoRef[]
  heroId?: string
  galleryId?: string
  finePrint: string | null
  lot: FactItem | null // the property's lot (acres when big enough) - for full stats panels
  /** Social posts: the call-to-action button, worded like Instagram's ad buttons ('Learn More', 'Contact Us'...); null = none. */
  socialButton: string | null
  /** Print footers: both phone numbers on one line even on a door hanger. */
  phonesInline?: boolean
  isPrint: boolean
  /** Door hanger (4.25in wide): the QR label and the fine print each stay on one line. */
  hanger: boolean
  /** Street hidden - just the town. The story is a line shorter, so photo layouts set it lower
   *  (snug above the agent) and keep the fade low and light - no empty band of dark photo. */
  townOnly: boolean
  /** Words written under the photo on a print (Keepsake lead-gen); undefined = the design's default. */
  photoCaption?: string
}

function buildQrTarget(block: DesignBlock, ctx: DesignCanvasContext): string {
  if (ctx.campaignUrl) return ctx.campaignUrl
  const target = block.data?.target || 'property'
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://openhousepal.com'
  if (target === 'custom' && block.data?.customUrl) return block.data.customUrl
  // "property" and "open_house_registration" both point at the open house sign-in page - that IS
  // this app's public "property page". Falls back to Agent Hub if no open house is linked yet.
  if ((target === 'property' || target === 'open_house_registration') && ctx.linkedOpenHouseFormUrl) {
    return `${base}${ctx.linkedOpenHouseFormUrl}`
  }
  if (target === 'buyer_form' && ctx.buyerFormSlug && ctx.agentHubSlug) return `${base}/${ctx.agentHubSlug}/${ctx.buyerFormSlug}`
  if (target === 'seller_form' && ctx.sellerFormSlug && ctx.agentHubSlug) return `${base}/${ctx.agentHubSlug}/${ctx.sellerFormSlug}`
  if (target.startsWith('form:') && ctx.agentHubSlug) return `${base}/${ctx.agentHubSlug}/${target.slice('form:'.length)}`
  if (!ctx.agentHubSlug) return base
  return `${base}/${ctx.agentHubSlug}`
}

function photoRef(raw: string | null | undefined, pos?: { x?: number; y?: number; zoom?: number; fit?: boolean } | null): PhotoRef | null {
  const src = resolveMediaUrl(raw || '')
  if (!src) return null
  return { src, x: typeof pos?.x === 'number' ? pos.x : 50, y: typeof pos?.y === 'number' ? pos.y : 50, zoom: pos?.zoom && pos.zoom > 0 ? pos.zoom : 1, fit: !!pos?.fit }
}

// A gallery block is required to show more than one photo. `autoFillCount` lets a template cap how
// many listing photos auto-fill before the agent stars any explicitly. Every collage photo carries
// its own crop (gallery `photoPositions`, keyed by URL); the hero's focal point/zoom covers photo 1.
function collectPhotos(visible: DesignBlock[], property: LinkedProperty | null): PhotoRef[] {
  const hero = visible.find(b => b.type === 'hero_photo')
  const gallery = visible.find(b => b.type === 'photo_gallery')
  const bestMain = property?.photos?.[0] || property?.image_url || undefined
  const heroRaw: string | undefined = hero ? fieldValue(hero, 'image_url', bestMain) : bestMain
  const heroPos = hero ? { x: hero.data?.photoFocalPoint?.x, y: hero.data?.photoFocalPoint?.y, zoom: hero.data?.photoZoom, fit: !!hero.data?.photoFit } : null
  const out: PhotoRef[] = []
  const heroRef = photoRef(heroRaw, heroPos)
  if (heroRef) out.push(heroRef)
  if (!gallery) return out
  const positions: Record<string, { x?: number; y?: number; zoom?: number }> = gallery.data?.photoPositions || {}
  const autoFillCount = gallery.data?.autoFillCount ?? 4
  const pool = property?.photos?.length ? property.photos : (property?.image_url ? [property.image_url] : [])
  const selectedRaw: string[] = gallery.data?.selectedPhotos?.length ? gallery.data.selectedPhotos : pool.filter(p => p !== heroRaw).slice(0, autoFillCount)
  const seen = new Set(heroRaw ? [heroRaw] : [])
  for (const raw of selectedRaw) {
    if (!raw || seen.has(raw) || out.length >= 4) continue
    seen.add(raw)
    const ref = photoRef(raw, positions[raw])
    if (ref) out.push(ref)
  }
  return out
}

// MLS feeds send addresses in ALL CAPS ("847 LESLEY RD", "VILLANOVA, PA 19085"). Set in a serif
// or a mixed-case style that shouts - so all-caps input is re-cased: words title-cased, ordinals
// lowered (17TH -> 17th), compass points and 2-letter state codes kept as caps. Anything the
// agent typed in mixed case is left exactly as typed.
const KEEP_CAPS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'PO', 'US'])
function niceCase(text: string): string {
  if (!text || /[a-z]/.test(text) || !/[A-Z]/.test(text)) return text
  return text.split(/(\s+|,)/).map((w, i, all) => {
    if (!/[A-Z]/.test(w)) return w
    if (KEEP_CAPS.has(w)) return w
    if (/^\d+(ST|ND|RD|TH)$/.test(w)) return w.toLowerCase()
    // A 2-letter token after a comma is a state code ("VILLANOVA, PA").
    const prev = all.slice(0, i).reverse().find(t => t.trim())
    if (w.length === 2 && prev === ',') return w
    return w.charAt(0) + w.slice(1).toLowerCase()
  }).join('')
}

function buildContent(blocks: DesignBlock[], ctx: DesignCanvasContext): Content {
  const visible = blocks.filter(b => !b.hidden)
  const find = (type: DesignBlock['type']) => visible.find(b => b.type === type)
  const property = ctx.property
  const situationDef = ctx.situation ? getSituation(ctx.situation) : undefined
  const leadGen = situationDef ? !situationDef.propertyAttached : !property && !find('address') && !find('price')
  const bk = ctx.brandKit

  const headlineBlock = find('headline')
  const headlineText: string = headlineBlock ? String(fieldValue(headlineBlock, 'text', headlineBlock.data?.text || '')).trim() : ''
  const addressBlock = find('address')
  const priceBlock = find('price')

  let kicker: Content['kicker'] = null
  let big: Content['big'] = null
  let title: Content['title'] = null
  let sub: Content['sub'] = null

  if (leadGen && !addressBlock) {
    if (headlineBlock && headlineText) {
      title = { id: headlineBlock.id, text: headlineText, o: textOverride(headlineBlock.style, bk), placeholder: false, isAddress: false }
      const eyebrow = String(headlineBlock.data?.eyebrow || '').trim()
      if (eyebrow) kicker = { id: headlineBlock.id, text: eyebrow, o: { k: 1, css: {} } }
      const subtext = String(headlineBlock.data?.subtext || '').trim()
      if (subtext) sub = { id: headlineBlock.id, text: subtext }
    }
  } else {
    if (headlineBlock && headlineText) {
      kicker = { id: headlineBlock.id, text: headlineText, o: textOverride(headlineBlock.style, bk) }
      big = { id: headlineBlock.id, text: headlineText, o: textOverride(headlineBlock.style, bk) }
    }
    if (addressBlock) {
      const full = niceCase(String(fieldValue(addressBlock, 'address', property?.address || '')).trim())
      // House number hidden: "412 Ridgemont Drive" -> "Ridgemont Drive" (the street, never the door).
      const line = addressBlock.data?.hideNumber ? full.replace(/^\s*\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?\s+/, '').trim() || full : full
      const city = niceCase(String(fieldValue(addressBlock, 'cityState', [property?.city, [property?.state, property?.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', '))).trim())
      if (addressBlock.data?.hideStreet) {
        // Street hidden: the town leads ("Gladwyne, PA"), zip dropped.
        const town = city.replace(/\s+\d{5}(-\d{4})?$/, '').trim()
        title = { id: addressBlock.id, text: town || 'Your Town', o: textOverride(addressBlock.style, bk), placeholder: !town, isAddress: true }
      } else {
        title = { id: addressBlock.id, text: line || 'Property Address', o: textOverride(addressBlock.style, bk), placeholder: !line, isAddress: true }
        if (city) sub = { id: addressBlock.id, text: city }
      }
    }
  }

  let price: Content['price'] = null
  if (priceBlock) {
    // Just Sold leads with the recorded sale price when we have it. A price the agent typed on a
    // Just Sold design is theirs to call the sale price; a bare list price is labeled as such.
    const sold = ctx.situation === 'just_sold'
    const typedPrice = (priceBlock.overrides?.price !== undefined && priceBlock.overrides?.price !== '') || priceBlock.data?.priceSource === 'manual'
    const basePrice = sold && property?.close_price ? property.close_price : property?.price
    const value = formatMoney(fieldValue(priceBlock, 'price', basePrice))
    if (value) {
      const currentNum = Number(String(fieldValue(priceBlock, 'price', basePrice)).replace(/[$,\s]/g, ''))
      const prevRaw = priceBlock.overrides?.previousPrice ?? (ctx.situation === 'price_improvement' ? property?.original_price : null)
      const prevNum = Number(String(prevRaw ?? '').replace(/[$,\s]/g, ''))
      const previous = prevRaw && !Number.isNaN(prevNum) && (Number.isNaN(currentNum) || prevNum > currentNum) ? formatMoney(prevRaw) : null
      const soldLabel = property?.close_price || typedPrice ? 'Sold for' : 'Listed at'
      const label = priceBlock.data?.label !== undefined ? String(priceBlock.data.label) : sold ? soldLabel : (PRICE_LABELS[ctx.situation || ''] || 'Offered at')
      const dupe = !!kicker && label.trim().toLowerCase() === kicker.text.trim().toLowerCase()
      price = { id: priceBlock.id, value, label: dupe ? '' : label, previous, o: textOverride(priceBlock.style, bk) }
    }
  }

  const details: DetailItem[] = []
  for (const b of visible) {
    const o = textOverride(b.style, bk)
    if (b.type === 'facts') {
      const fields: string[] = b.data?.fields?.length ? b.data.fields : [...DEFAULT_FACT_FIELDS]
      const items = fields.map(key => factItem(key, fieldValue(b, key, (property as any)?.[key]))).filter(Boolean) as FactItem[]
      if (items.length) details.push({ kind: 'facts', id: b.id, items, o })
    } else if (b.type === 'open_house_details') {
      const date = String(fieldValue(b, 'date', b.data?.date || '') || '').trim()
      const time = String(fieldValue(b, 'time', b.data?.time || '') || '').trim()
      if (date || time) details.push({ kind: 'openHouse', id: b.id, date, time, o })
    } else if (b.type === 'description') {
      const text = String(fieldValue(b, 'text', b.data?.text || '') || '').trim()
      if (text) details.push({ kind: 'description', id: b.id, text, o })
    } else if (b.type === 'highlights') {
      const items: string[] = (fieldValue(b, 'items', b.data?.items) || []).map((s: any) => String(s || '').trim()).filter(Boolean)
      if (items.length) details.push({ kind: 'highlights', id: b.id, items: items.slice(0, 5), o })
    } else if (b.type === 'cta') {
      const label = String(fieldValue(b, 'label', b.data?.label || '') || '').trim()
      if (label) details.push({ kind: 'cta', id: b.id, label, o })
    }
  }

  const qrBlock = find('qr_code')
  const qr = qrBlock ? { id: qrBlock.id, url: buildQrTarget(qrBlock, ctx), label: qrWords(String(qrBlock.data?.label || '').trim()) } : null

  const agentBlock = find('agent_info')
  // Real profile data first (Settings + Agent Hub); any line can be overridden for this one design
  // from the editor's "You" card - blank means "use my profile".
  const av = (key: string, fallback: string | null | undefined) => String(fieldValue(agentBlock!, key, fallback || '') || '').trim()
  const agent = agentBlock ? {
    id: agentBlock.id,
    name: av('name', ctx.agentName),
    title: av('title', ctx.agentTitle),
    brokerage: av('brokerage', ctx.agentBrokerage),
    phone: agentBlock.data?.hidePhone ? '' : formatPhone(av('phone', ctx.agentPhone)),
    // Print only: the brokerage's office line under the agent's own number (advertising rules want
    // the broker's name + phone on mailers, flyers and door hangers; social posts don't carry it).
    office: ctx.format.isPrint ? formatPhone(String(ctx.agentOfficePhone || '').trim()) : '',
    email: agentBlock.data?.hideEmail ? '' : av('email', ctx.agentEmail),
    website: agentBlock.data?.hideWebsite ? '' : av('website', '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    photo: agentBlock.data?.hidePhoto ? null : (resolveMediaUrl(av('photo_url', ctx.agentPhotoUrl)) || null),
    pos: agentBlock.overrides?.photo_url ? null : (ctx.agentPhotoPosition || null),
  } : null

  // Logo shows unless the Brokerage Branding element was explicitly hidden - looked up in the full
  // (unfiltered) list, since `visible` would treat hidden and never-added the same.
  const brandingBlockAny = blocks.find(b => b.type === 'brokerage_branding')
  const logoRaw = ctx.brandingMode === 'team' ? bk?.team_logo_url
    : ctx.brandingMode === 'brokerage' ? bk?.brokerage_logo_url
    : ctx.brandingMode === 'personal' ? bk?.personal_logo_url
    : null
  const logo = !brandingBlockAny?.hidden ? (resolveMediaUrl(logoRaw || '') || null) : null
  // Smaller / normal / larger logo, chosen on the editor's Logo card.
  const logoScale = Number(brandingBlockAny?.data?.scale) > 0 ? Number(brandingBlockAny!.data.scale) : 1

  const hero = find('hero_photo')
  const gallery = find('photo_gallery')
  const photos = collectPhotos(visible, property)

  // Fine print on everything that gets printed and mailed. The agent can rewrite or clear it on the
  // Agent Info element; otherwise the Brand Kit disclaimer wins, then a sensible default.
  let finePrint: string | null = null
  if (agentBlock && agentBlock.data?.disclaimer !== undefined) {
    finePrint = String(agentBlock.data.disclaimer || '').trim() || null
  } else if (ctx.format.isPrint || leadGen) {
    finePrint = (bk?.disclaimer_text || '').trim() || (leadGen
      ? 'If your property is currently listed for sale, this is not intended as a solicitation. Equal Housing Opportunity.'
      : 'Information deemed reliable but not guaranteed. Equal Housing Opportunity.')
  }

  return {
    lot: property?.lot_size ? factItem('lot_size', (property as any).lot_size) : null,
    socialButton: (() => { const v = String(headlineBlock?.data?.socialButton ?? 'none').trim(); return v && v !== 'none' ? v : null })(),
    leadGen, situation: ctx.situation || null, kicker, big, title, sub, price, details, qr, agent, logo, logoScale, photos,
    heroId: hero?.id, galleryId: gallery?.id, finePrint, isPrint: ctx.format.isPrint, hanger: ctx.format.designType === 'door_hanger',
    townOnly: !!addressBlock?.data?.hideStreet && !leadGen,
    photoCaption: typeof hero?.data?.caption === 'string' ? hero.data.caption : undefined,
  }
}

// Long real-world content (a 45-character street line, a two-day open house, a struck-through
// previous price) steps the whole type scale down a touch, so fixed panels never clip and the
// layout keeps its proportions. Applied once at the entry point; every composition inherits it.
function densityScale(c: Content): number {
  const titleLen = c.title?.text.length || 0
  let k = 1
  if (titleLen > 24) k -= 0.06
  if (titleLen > 36) k -= 0.06
  const oh = c.details.find(d => d.kind === 'openHouse') as Extract<DetailItem, { kind: 'openHouse' }> | undefined
  if (oh && oh.date.length + oh.time.length > 30) k -= 0.04
  if (c.price?.previous) k -= 0.02
  return Math.max(0.82, k)
}

// ---------------------------------------------------------------------------------------------
// Selection (editor only) - a thin wrapper so every element on the canvas is clickable.
// ---------------------------------------------------------------------------------------------
interface Sel { selectedBlockId?: string | null; onSelectBlock?: (id: string) => void }

function Pick({ id, sel, children, style, className }: { id?: string; sel: Sel; children: ReactNode; style?: CSSProperties; className?: string }) {
  if (!id || !sel.onSelectBlock) return <div style={style} className={className}>{children}</div>
  const selected = sel.selectedBlockId === id
  return (
    <div
      style={{ ...style, cursor: 'pointer', outline: selected ? '2px solid #C9A24D' : undefined, outlineOffset: 2 }}
      className={`${className || ''} ${selected ? '' : 'hover:outline hover:outline-2 hover:outline-[#C9A24D]/50'}`}
      onClick={e => { e.stopPropagation(); sel.onSelectBlock!(id) }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Ink - which colors text uses depending on what it sits on.
// ---------------------------------------------------------------------------------------------
interface Ink { ink: string; muted: string; accent: string; rule: string; fill: string; fillInk: string; onPhoto: boolean; panel: string }

function inkOnBg(t: DesignTheme): Ink {
  return { ink: t.ink, muted: t.muted, accent: t.accent, rule: t.rule, fill: t.accent, fillInk: t.accentInk, onPhoto: false, panel: t.bg }
}
function inkOnPhoto(t: DesignTheme): Ink {
  // Light themes lay a paper-colored fade over the photo (their scrim is the paper tone) and set
  // dark type on it; dark themes keep white type over a tinted dark fade.
  if (!t.isDark) return { ink: t.ink, muted: t.muted, accent: t.accent, rule: hexA(t.ink, 0.22), fill: t.accent, fillInk: t.accentInk, onPhoto: false, panel: t.bg }
  return { ink: '#FFFFFF', muted: 'rgba(255,255,255,0.82)', accent: t.photoAccent, rule: 'rgba(255,255,255,0.34)', fill: t.photoAccent, fillInk: '#15161A', onPhoto: true, panel: `rgb(${t.scrim})` }
}

// ---------------------------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------------------------
function Photo({ photo, style, radius = 0, t, children, pickId, sel }: { photo?: PhotoRef | null; style?: CSSProperties; radius?: number | string; t: DesignTheme; children?: ReactNode; pickId?: string; sel: Sel }) {
  const r = typeof radius === 'number' ? u(radius) : radius
  // "Whole photo": nothing cropped - the full picture sits inside the frame over a soft, blurred
  // copy of itself, so the edges read as atmosphere instead of empty bars.
  const inner = photo?.fit ? (
    <>
      <div style={{ position: 'absolute', inset: '-6%', backgroundImage: `url("${photo.src}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(2.4cqmin) brightness(0.72) saturate(1.1)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${photo.src}")`, backgroundSize: 'contain', backgroundPosition: `${photo.x}% ${photo.y}%`, backgroundRepeat: 'no-repeat', transform: photo.zoom !== 1 ? `scale(${photo.zoom})` : undefined, transformOrigin: `${photo.x}% ${photo.y}%` }} />
    </>
  ) : photo ? (
    <div
      style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("${photo.src}")`, backgroundSize: 'cover', backgroundPosition: `${photo.x}% ${photo.y}%`, backgroundRepeat: 'no-repeat',
        transform: photo.zoom !== 1 ? `scale(${photo.zoom})` : undefined, transformOrigin: `${photo.x}% ${photo.y}%`,
      }}
    />
  ) : (
    // No photo: a quiet tonal surface. The house mark only shows while editing (a nudge to add
    // one) - never in a thumbnail or an export.
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(80% 70% at 72% 24%, ${t.surface}, transparent 70%), linear-gradient(135deg, ${t.surface}, ${t.bg})` }}>
      {sel.onSelectBlock && <Home style={{ width: '18%', height: '18%', maxWidth: u(16), color: t.muted, opacity: 0.35 }} strokeWidth={1.2} />}
    </div>
  )
  return (
    <Pick id={pickId} sel={sel} style={{ position: 'relative', overflow: 'hidden', borderRadius: r, ...style }}>
      {inner}
      {children}
    </Pick>
  )
}

function Rule({ color, width = '100%', vertical = false, style }: { color: string; width?: string; vertical?: boolean; style?: CSSProperties }) {
  return vertical
    ? <span style={{ display: 'block', width: hair, alignSelf: 'stretch', background: color, ...style }} />
    : <span style={{ display: 'block', height: hair, width, background: color, flexShrink: 0, ...style }} />
}

function Kicker({ text, t, ink, size, align, o }: { text: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; o?: TextOverride }) {
  // Widely-tracked caps eat width fast - long kickers ("Complimentary Home Valuation") step down in
  // size, then wrap, instead of running off a narrow column.
  const comfortable = t.kicker.transform === 'uppercase' ? (t.styleId === 'modern_luxury' ? 16 : 20) : 26
  const fs = fit(text, size * t.kicker.scale * (o?.k || 1), comfortable, 0.7)
  const long = text.length > comfortable
  const base: CSSProperties = {
    fontFamily: t.fonts.kicker, fontWeight: t.kicker.weight, fontStyle: t.kicker.italic ? 'italic' : 'normal',
    textTransform: t.kicker.transform, letterSpacing: t.kicker.tracking, fontSize: u(fs), lineHeight: 1.3,
    whiteSpace: long ? 'normal' : 'nowrap', textAlign: align,
  }
  const justify = align === 'center' ? 'center' : 'flex-start'
  switch (t.kicker.treatment) {
    case 'block':
      return (
        <div style={{ display: 'flex', justifyContent: justify }}>
          <span style={{ ...base, display: 'inline-block', background: ink.fill, color: ink.fillInk, padding: `${u(fs * 0.42)} ${u(fs * 0.75)} ${u(fs * 0.36)}`, ...o?.css }}>{text}</span>
        </div>
      )
    case 'flanked':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: justify, gap: u(fs * 1.1), color: ink.accent, maxWidth: '100%', overflow: 'hidden' }}>
          {align === 'center' && !long && <Rule color={ink.accent} width={u(fs * 3.2)} style={{ flexShrink: 1, minWidth: u(fs * 1.2) }} />}
          <span style={{ ...base, paddingLeft: align === 'center' ? t.kicker.tracking : undefined, ...o?.css }}>{text}</span>
          {!long && <Rule color={ink.accent} width={u(fs * 3.2)} style={{ flexShrink: 1, minWidth: u(fs * 1.2) }} />}
        </div>
      )
    case 'dot':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: justify, gap: u(fs * 0.8), color: ink.onPhoto ? '#fff' : t.ink }}>
          <span style={{ display: 'block', width: u(fs * 0.62), height: u(fs * 0.62), background: ink.accent, borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ ...base, ...o?.css }}>{text}</span>
        </div>
      )
    case 'rule':
    default:
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: justify, gap: u(fs * 0.7), color: ink.accent, maxWidth: '100%', overflow: 'hidden' }}>
          {align !== 'center' && <Rule color={ink.accent} width={u(fs * 2.4)} style={{ flexShrink: 1, minWidth: u(fs * 1.2) }} />}
          <span style={{ ...base, ...o?.css }}>{text}</span>
          {align === 'center' && <Rule color={ink.accent} width={u(fs * 2.4)} style={{ flexShrink: 1, minWidth: u(fs * 1.2) }} />}
        </div>
      )
  }
}

function Title({ text, t, ink, size, align, o, placeholder, maxChars = 22, style }: { text: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; o?: TextOverride; placeholder?: boolean; maxChars?: number; style?: CSSProperties }) {
  // Wide-tracked serif caps take ~25% more room per character; condensed Anton ~15% less.
  const widthFactor = t.styleId === 'modern_luxury' ? 0.8 : t.styleId === 'bold' ? 1.15 : 1
  // Never below 70% - a long address wraps to a second balanced line rather than going tiny.
  const fs = fit(text, size, maxChars * widthFactor, 0.7) * (o?.k || 1)
  return (
    <div style={{
      fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, letterSpacing: t.display.tracking,
      lineHeight: t.display.leading, fontSize: u(fs), color: ink.ink, opacity: placeholder ? 0.45 : 1, textAlign: align,
      textWrap: 'balance' as any, ...style, ...o?.css,
    }}>
      {text}
    </div>
  )
}

// A long headline as two tones (user 10/09: "spice up long titles"): the first half in the theme's
// display caps, the rest as a larger italic line in the accent - split at the most balanced word
// break. Short titles stay a plain Title.
function splitTitle(text: string): [string, string] | null {
  const words = text.trim().split(/\s+/)
  if (text.length <= 20 || words.length < 4) return null
  let best = 1
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length
    const b = words.slice(i).join(' ').length
    const diff = Math.abs(a - b) + (a > b ? 2 : 0) // a slightly shorter first line reads better
    if (diff < bestDiff) { bestDiff = diff; best = i }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}
// Headline title case (user 10/09): every word capitalised except short joining words, which stay
// lowercase unless first or last - "Would You Sell if the Price Were Right?". Words the agent typed
// with capitals inside (iPhone, McLean, ADU) are left exactly as typed.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'via', 'if', 'vs'])
function titleCase(text: string): string {
  const words = text.trim().split(/(\s+)/)
  const real = words.filter(w => w.trim()).length
  let n = 0
  return words.map(w => {
    if (!w.trim()) return w
    const i = n++
    if (/[A-Z]/.test(w.slice(1))) return w
    const bare = w.toLowerCase().replace(/[^a-z']/g, '')
    if (i > 0 && i < real - 1 && SMALL_WORDS.has(bare)) return w.toLowerCase()
    return w.replace(/^([^A-Za-z]*)([a-z])/, (_, p1, c) => p1 + c.toUpperCase())
  }).join('')
}

// Title-case serif headline (Postage) - larger, balanced lines.
function SerifHeadline({ text, t, ink, size, align, o, placeholder, comfortable = 30, accent }: { text: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; o?: TextOverride; placeholder?: boolean; comfortable?: number; accent?: string }) {
  const tt = titleCase(text)
  const m = accent ? tt.match(/^([\s\S]*?)([?.!]+)$/) : null
  return (
    <div style={{
      fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, textTransform: 'none', letterSpacing: '-0.005em',
      lineHeight: 1.08, fontSize: u(fit(text, size * 1.12, comfortable, 0.72) * (o?.k || 1)), color: ink.ink, textAlign: align,
      textWrap: 'balance' as any, opacity: placeholder ? 0.45 : 1, maxWidth: '96%', ...o?.css,
    }}>{m ? <>{m[1]}<span style={{ color: accent, fontStyle: 'italic' }}>{m[2]}</span></> : tt}</div>
  )
}

function TwoToneTitle({ text, t, ink, size, align, accent, o, placeholder }: { text: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; accent: string; o?: TextOverride; placeholder?: boolean }) {
  // A really long headline (an agent's own question) reads better in the serif's sentence case -
  // larger, balanced lines - than as a wall of capitals (user 10/09).
  if (text.length > 34) {
    return (
      <div style={{
        fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, textTransform: 'none', letterSpacing: '-0.005em',
        lineHeight: 1.08, fontSize: u(fit(text, size * 1.12, 30, 0.72) * (o?.k || 1)), color: ink.ink, textAlign: align,
        textWrap: 'balance' as any, opacity: placeholder ? 0.45 : 1, maxWidth: '96%',
      }}>{text.charAt(0).toUpperCase() + text.slice(1)}</div>
    )
  }
  const parts = splitTitle(text)
  if (!parts) return <Title text={text} t={t} ink={ink} size={size} align={align} o={o} placeholder={placeholder} maxChars={14} />
  const [top, bottom] = parts
  // user 10/09: one look - the whole headline in the theme's display caps, one size, one colour,
  // split into two balanced lines (no italic half, no gold half).
  const widthFactor = t.styleId === 'modern_luxury' ? 0.8 : t.styleId === 'bold' ? 1.15 : 1
  const fs = fit(top.length > bottom.length ? top : bottom, size, 14 * widthFactor, 0.62) * (o?.k || 1)
  const line: CSSProperties = { fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, letterSpacing: t.display.tracking, lineHeight: t.display.leading, fontSize: u(fs), textWrap: 'balance' as any }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', opacity: placeholder ? 0.45 : 1, textAlign: align }}>
      <div style={{ ...line, color: ink.ink }}>{top}</div>
      <div style={{ ...line, color: ink.ink }}>{bottom}</div>
    </div>
  )
}

function Sub({ text, t, ink, size, align, style }: { text: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; style?: CSSProperties }) {
  // a town line ("Bryn Mawr, PA 19010") never breaks before the zip (user 10/12): short lines fit to one
  if (text.length <= 40) return <FitLines text={text} size={size * 0.82} lines={1} style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, lineHeight: 1.35, color: ink.muted, textAlign: align, ...style }} />
  return (
    <div style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(size * 0.82), lineHeight: 1.35, color: ink.muted, textAlign: align, ...style }}>
      {text}
    </div>
  )
}

function Lede({ text, t, ink, size, align, style }: { text: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: t.fonts.body, fontWeight: 400, fontSize: u(size), lineHeight: 1.45, color: ink.muted, textAlign: align, textWrap: 'pretty' as any, ...style }}>
      {text}
    </div>
  )
}

function Price({ price, t, ink, size, align, showLabel = true }: { price: NonNullable<Content['price']>; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; showLabel?: boolean }) {
  const fs = size * t.price.scale * price.o.k
  const color = t.styleId === 'editorial' || t.styleId === 'bold' ? ink.accent : ink.ink
  return (
    <div style={{ textAlign: align }}>
      {showLabel && price.label && (
        <div style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(Math.max(size * 0.3, 1)), color: ink.muted, marginBottom: u(size * 0.14) }}>
          {price.label}
        </div>
      )}
      <div style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(fs), lineHeight: 1, color, fontVariantNumeric: 'lining-nums', ...price.o.css }}>
        {price.value}
      </div>
      {price.previous && (
        <div style={{ fontFamily: t.fonts.body, fontSize: u(size * 0.4), color: ink.muted, marginTop: u(size * 0.2), letterSpacing: '0.02em' }}>
          Previously <span style={{ textDecoration: 'line-through' }}>{price.previous}</span>
        </div>
      )}
    </div>
  )
}

function Facts({ items, t, ink, size, align, variant = 'stats', o }: { items: FactItem[]; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; variant?: 'stats' | 'inline' | 'grid'; o?: TextOverride }) {
  const k = o?.k || 1
  if (variant === 'grid') {
    // Two-up grid for narrow columns - stats that can't fit on one line never get clipped.
    const valueFont = t.styleId === 'minimal' ? t.fonts.display : t.fonts.price
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: u(size * 1.2), rowGap: u(size * 0.9) }}>
        {items.map(f => (
          <div key={f.key} style={{ borderTop: `${hair} solid ${ink.rule}`, paddingTop: u(size * 0.5), minWidth: 0 }}>
            <div style={{ fontFamily: valueFont, fontWeight: t.styleId === 'minimal' ? 600 : t.price.weight, fontSize: u(size * 1.45 * k), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', ...o?.css }}>{f.value}</div>
            <div style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(size * 0.56 * k), color: ink.muted, marginTop: u(size * 0.38), whiteSpace: 'nowrap' }}>{f.label}</div>
          </div>
        ))}
      </div>
    )
  }
  if (variant === 'inline') {
    return (
      <div style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(size * 0.8 * k), color: ink.ink, textAlign: align, lineHeight: 1.4, ...o?.css }}>
        {items.map((f, i) => (
          <span key={f.key}>
            {i > 0 && <span style={{ color: ink.accent, padding: `0 ${u(size * 0.55)}` }}>{t.styleId === 'modern_luxury' ? '|' : '·'}</span>}
            <span style={{ whiteSpace: 'nowrap' }}>{f.value} {f.label}</span>
          </span>
        ))}
      </div>
    )
  }
  const valueFont = t.styleId === 'minimal' ? t.fonts.display : t.fonts.price
  return (
    <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', alignItems: 'stretch' }}>
      {items.map((f, i) => (
        <div key={f.key} style={{ display: 'flex', alignItems: 'stretch' }}>
          {i > 0 && <Rule color={ink.rule} vertical style={{ margin: `0 ${u(size * 1.05)}` }} />}
          <div style={{ textAlign: align === 'center' ? 'center' : 'left' }}>
            <div style={{ fontFamily: valueFont, fontWeight: t.styleId === 'minimal' ? 600 : t.price.weight, fontSize: u(size * 1.55 * k), lineHeight: 1, color: ink.ink, letterSpacing: t.styleId === 'modern_luxury' ? '0.03em' : t.styleId === 'minimal' ? '-0.02em' : undefined, whiteSpace: 'nowrap', ...o?.css }}>
              {f.value}
            </div>
            <div style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(size * 0.56 * k), color: ink.muted, marginTop: u(size * 0.42), whiteSpace: 'nowrap' }}>
              {f.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// An open house as short lines for one-line strips (user 10/10: "two days, two different times?"):
// two days with their own hours -> one line per day ("Sun, Nov 30 · 11:30 AM–1:30 PM"); anything that
// runs long gets the short weekday/month names. Fits within `max` characters a line where it can.
function ohLines(date: string, time: string, max = 32): string[] {
  const full = [date, time].filter(Boolean).join(' · ')
  const sh = (d: string) => d.replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*\.?/gi, '$1').replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?/gi, '$1')
  const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').trim()
  const days = date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean)
  const times = time.split(/\s*(?:&|\band\b|\/)\s*/i).filter(Boolean)
  if (days.length === 2 && times.length === 2) return days.map((d, i) => `${sh(d)} · ${clean(times[i])}`)
  const md = days.map(d => sh(d).match(/^(?:([A-Za-z]+),\s*)?([A-Za-z]+)\s+(\d+)/))
  if (days.length > 1 && md.every(m => m && m[2] === md[0]![2])) {
    const wds = md.map(m => m![1]).filter(Boolean)
    const one = `${wds.length ? `${wds.join(' & ')}, ` : ''}${md[0]![2]} ${md.map(m => m![3]).join(' & ')}`
    const both = [one, clean(time)].filter(Boolean).join(' · ')
    return both.length <= max ? [both] : [one, clean(time)].filter(Boolean)
  }
  if (full.length <= max) return [full]
  const short = [sh(date), clean(time)].filter(Boolean).join(' · ')
  return short.length <= max ? [short] : [sh(date), clean(time)].filter(Boolean)
}

function OpenHouseLine({ date, time, t, ink, size, align, variant = 'line', o }: { date: string; time: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; variant?: 'line' | 'hero'; o?: TextOverride }) {
  const k = o?.k || 1
  if (variant === 'hero') {
    return (
      <div style={{ textAlign: align }}>
        {date && <div style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, letterSpacing: t.display.tracking, fontSize: u(size * 2.1 * k), lineHeight: 1.05, color: ink.ink, ...o?.css }}>{date}</div>}
        {time && <div style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(size * 0.95 * k), color: ink.accent, marginTop: u(size * 0.6) }}>{time}</div>}
      </div>
    )
  }
  return (
    <div style={{ fontFamily: t.fonts.label, fontWeight: Math.max(t.label.weight, 600), textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(size * 0.9 * k), color: ink.accent, textAlign: align, lineHeight: 1.35, ...o?.css }}>
      {date && time && /&|\band\b/i.test(date)
        ? ohLines(date, time).map(l => <span key={l} style={{ display: 'block' }}>{l}</span>)
        : date && time && (date.length + time.length > 28)
          ? <><span style={{ display: 'block' }}>{date}</span><span style={{ display: 'block' }}>{time}</span></>
          : [date, time].filter(Boolean).join('  ·  ')}
    </div>
  )
}

function Highlights({ items, t, ink, size, align, o }: { items: string[]; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; o?: TextOverride }) {
  const k = o?.k || 1
  const mark = t.styleId === 'modern_luxury' ? '◆' : t.styleId === 'bold' ? '■' : t.styleId === 'minimal' ? '—' : '•'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(size * 0.45), alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: u(size * 0.6), alignItems: 'baseline', fontFamily: t.fonts.body, fontSize: u(size * k), color: ink.ink, lineHeight: 1.35, ...o?.css }}>
          <span style={{ color: ink.accent, fontSize: u(size * 0.62 * k), flexShrink: 0 }}>{mark}</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function CtaButton({ label, t, ink, size, align, o, solid = false, oneLine = false }: { label: string; t: DesignTheme; ink: Ink; size: number; align: 'left' | 'center'; o?: TextOverride; solid?: boolean; oneLine?: boolean }) {
  const k = o?.k || 1
  const radius = t.styleId === 'editorial' ? '999px' : t.styleId === 'minimal' ? u(size * 0.5) : solid ? u(size * 0.3) : '0'
  const outline = t.styleId === 'modern_luxury' && !solid
  return (
    <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <span style={{
        display: 'inline-block', fontFamily: t.fonts.label, fontWeight: t.styleId === 'bold' || solid ? 800 : 600, textTransform: 'uppercase',
        letterSpacing: solid ? '0.14em' : t.styleId === 'modern_luxury' ? '0.26em' : '0.12em', fontSize: u(solid ? fit(label, size * 0.82 * k, 26, 0.68) : size * 0.78 * k),
        ...(solid ? { whiteSpace: oneLine ? 'nowrap' : 'normal', maxWidth: '100%', textAlign: 'center', textWrap: 'balance' as any, boxShadow: '0 0.5cqmin 1.4cqmin rgba(0,0,0,0.18)' } : {}),
        padding: `${u(size * 0.85)} ${u(size * 1.5)}`, borderRadius: radius, lineHeight: 1.1,
        background: outline ? 'transparent' : ink.fill, color: outline ? ink.ink : ink.fillInk,
        border: outline ? `${hair} solid ${ink.accent}` : undefined, ...o?.css,
      }}>
        {label}
      </span>
    </div>
  )
}

// Door hanger call to action (user 10/09): not a fake button - the ask in an elegant italic, with a
// hand-drawn arrow on the left curving down to the QR code in the footer, and "Scan the code below".
// Door hangers (user 10/10): the ask centred on the page, and the arrow measured to land right over the
// centre of the QR code in the footer - wherever the centred footer puts it for this agent's name.
function FitLines({ text, size, lines = 2, style, node }: { text: string; size: number; lines?: number; style: CSSProperties; node?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [k, setK] = useState(1)
  const [, setTick] = useState(0)
  useLayoutEffect(() => { setK(1) }, [text, size])
  // re-check when the web fonts arrive or the card resizes (the first pass may measure a fallback font)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setTick(n => n + 1))
    ro.observe(el)
    document.fonts?.ready.then(() => setTick(n => n + 1)).catch(() => {})
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fs = parseFloat(getComputedStyle(el).fontSize) || 1
    const lh = parseFloat(getComputedStyle(el).lineHeight) || fs * 1.15
    if (el.offsetHeight > lh * (lines + 0.4) && k > 0.45) setK(v => Math.max(0.45, v * 0.93))
  })
  return <span ref={ref} data-fit={k.toFixed(2)} style={{ ...style, display: 'block', fontSize: u(size * k) }}>{node ?? text}</span>
}

function QrPointerPrompt({ label, sub, t, ink, size, accent, o }: { label: string; sub?: string; t: DesignTheme; ink: Ink; size: number; accent: string; o?: TextOverride }) {
  const k = o?.k || 1
  const box = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLDivElement>(null)
  const askRef = useRef<HTMLSpanElement>(null)
  const [g, setG] = useState<{ tip: number; start: number } | null>(null)
  // the ask never runs past two lines (user 10/10: "Your home's value in today's market" was three)
  const [fk, setFk] = useState(1)
  const [, setTick2] = useState(0)
  useEffect(() => {
    const el = askRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTick2(n => n + 1))
    ro.observe(el)
    document.fonts?.ready.then(() => setTick2(n => n + 1)).catch(() => {})
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = askRef.current
    if (!el) return
    const fs = parseFloat(getComputedStyle(el).fontSize) || 1
    if (el.offsetHeight / (fs * 1.15) > 2.25 && fk > 0.6) setFk(f => Math.max(0.6, f * 0.92))
  })
  const measure = () => {
    const b = box.current, w = words.current
    if (!b || !w) return
    const qr = b.closest('[data-design-canvas]')?.querySelector('[data-qr-box]') as HTMLElement | null
    const B = b.getBoundingClientRect(), W = w.getBoundingClientRect()
    if (!qr || !B.width) { setG(prev => (prev ? null : prev)); return }
    const Q = qr.getBoundingClientRect()
    const next = { tip: (Q.left + Q.width / 2 - B.left) / B.width, start: (W.left - B.left) / B.width }
    setG(prev => (prev && Math.abs(prev.tip - next.tip) < 0.002 && Math.abs(prev.start - next.start) < 0.002 ? prev : next))
  }
  // every render (an edited name moves the centred footer's QR), plus when fonts and sizes settle
  useLayoutEffect(measure)
  useEffect(() => {
    const b = box.current
    if (!b) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(b)
    const root = b.closest('[data-design-canvas]')
    if (root) ro.observe(root)
    document.fonts?.ready.then(() => measure()).catch(() => {})
    const late = window.setTimeout(measure, 400)
    return () => { ro.disconnect(); window.clearTimeout(late) }
  }, [])
  const room = g ? g.start - g.tip : 0
  // a long ask wraps a little narrower (still centred) so the arrow always has room to swoop
  const cap = g ? Math.max(0.52, Math.min(0.66, 2 * (0.5 - g.tip - 0.05))) : 0.62
  const stroke = { stroke: accent, strokeWidth: u(size * 0.14), strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <div ref={box} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div ref={words} style={{ display: 'flex', flexDirection: 'column', gap: u(size * 0.3), alignItems: 'center', textAlign: 'center', maxWidth: `${cap * 100}%`, minWidth: 0 }}>
        <span ref={askRef} style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: u(fit(label, size * 1.55 * k, 22, 0.7) * fk), lineHeight: 1.15, color: ink.ink, textWrap: 'balance' as any, ...o?.css }}>{label}</span>
        <span style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: u(fit(sub || 'Scan the code below', size * 0.62, 24, 0.6)), color: accent, whiteSpace: 'nowrap' }}>{sub || 'Scan the code below'}</span>
      </div>
      {g && room > 0.02 && (
        <>
          {/* the swoop: from beside the words, out and down to a point straight over the QR's centre */}
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: `${g.tip * 100}%`, width: `${Math.max(1.5, (room - Math.min(0.03, room * 0.35)) * 100)}%`, top: '20%', height: `calc(80% - ${u(size * 0.32)})`, overflow: 'visible' }}>
            <path d="M100 2 C 40 2, 0 25, 0 100" vectorEffect="non-scaling-stroke" style={stroke} />
          </svg>
          <svg aria-hidden viewBox="0 0 12 8" style={{ position: 'absolute', left: `${g.tip * 100}%`, bottom: u(size * 0.12), width: u(size * 0.95), height: u(size * 0.63), transform: 'translateX(-50%)', overflow: 'visible' }}>
            <path d="M1 1 L6 7 L11 1" style={stroke} />
          </svg>
        </>
      )}
    </div>
  )
}

function ScanPrompt({ label, sub, t, ink, size, accent, o, arrow = 'left', align = 'center' }: { label: string; sub?: string; t: DesignTheme; ink: Ink; size: number; accent: string; o?: TextOverride; arrow?: 'left' | 'right' | null; align?: 'left' | 'center' }) {
  if (arrow === 'left') return <QrPointerPrompt label={label} sub={sub} t={t} ink={ink} size={size} accent={accent} o={o} />
  const k = o?.k || 1
  const svg = (side: 'left' | 'right') => (
    <svg viewBox="0 0 32 40" fill="none" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(size * 2.1), height: u(size * 2.6), flexShrink: 0, transform: `translateY(18%)${side === 'right' ? ' scaleX(-1)' : ''}` }}>
      <path d="M29 4 C 17 4, 8 11, 8 33" />
      <path d="M2.5 27.5 L8 34.5 L13.5 27.5" />
    </svg>
  )
  const words = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(size * 0.3), alignItems: arrow === 'right' ? 'flex-end' : arrow === 'left' || align === 'center' ? 'center' : 'flex-start', textAlign: arrow === 'right' ? 'right' : arrow === 'left' ? 'center' : align, minWidth: 0 }}>
      <span style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: u(fit(label, size * 1.55 * k, 22, 0.7)), lineHeight: 1.15, color: ink.ink, textWrap: 'balance' as any, ...o?.css }}>{label}</span>
      {arrow && <span style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: u(fit(sub || 'Scan the code below', size * 0.62, 26, 0.7)), color: accent, whiteSpace: 'nowrap' }}>{sub || 'Scan the code below'}</span>}
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: arrow === 'right' ? 'flex-end' : align === 'center' || arrow === 'left' ? 'center' : 'flex-start', gap: u(size * 0.7), maxWidth: arrow === 'right' ? '100%' : '92%' }}>
      {words}
      {arrow === 'right' && svg('right')}
    </div>
  )
}

function Details({ c, t, ink, S, align, sel, only, variants = {}, clamp = 4 }: {
  c: Content; t: DesignTheme; ink: Ink; S: Sizes; align: 'left' | 'center'; sel: Sel
  only?: DetailItem['kind'][]
  variants?: { facts?: 'stats' | 'inline' | 'grid'; openHouse?: 'line' | 'hero' }
  clamp?: number
}) {
  const items = only ? c.details.filter(d => only.includes(d.kind)) : c.details
  if (!items.length) return null
  return (
    <>
      {items.map(d => (
        <Pick key={d.id} id={d.id} sel={sel}>
          {d.kind === 'facts' && <Facts items={d.items} t={t} ink={ink} size={S.facts} align={align} variant={variants.facts} o={d.o} />}
          {d.kind === 'openHouse' && <OpenHouseLine date={d.date} time={d.time} t={t} ink={ink} size={S.facts} align={align} variant={variants.openHouse} o={d.o} />}
          {d.kind === 'description' && (
            <div style={{
              fontFamily: t.fonts.body, fontSize: u(S.body * d.o.k), lineHeight: 1.55, color: ink.muted, textAlign: align,
              display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden', ...d.o.css,
            }}>{d.text}</div>
          )}
          {d.kind === 'highlights' && <Highlights items={d.items} t={t} ink={ink} size={S.body} align={align} o={d.o} />}
          {d.kind === 'cta' && <CtaButton label={d.label} t={t} ink={ink} size={S.facts} align={align} o={d.o} solid oneLine={c.hanger} />}
        </Pick>
      ))}
    </>
  )
}

// Was this image URL reachable? null while unknown (first paint shows the element), false once a
// load failed - cached per URL so the same dead link never re-fetches.
const IMAGE_OK = new Map<string, boolean>()
function useImageOk(src: string | null): boolean | null {
  const [ok, setOk] = useState<boolean | null>(() => (src && IMAGE_OK.has(src) ? IMAGE_OK.get(src)! : null))
  useEffect(() => {
    if (!src) return
    if (IMAGE_OK.has(src)) { setOk(IMAGE_OK.get(src)!); return }
    let alive = true
    const img = new Image()
    img.onload = () => { IMAGE_OK.set(src, true); if (alive) setOk(true) }
    img.onerror = () => { IMAGE_OK.set(src, false); if (alive) setOk(false) }
    img.src = src
    return () => { alive = false }
  }, [src])
  return ok
}

function Headshot({ agent, size, ring }: { agent: NonNullable<Content['agent']>; size: number; ring: string }) {
  const ok = useImageOk(agent.photo)
  if (!agent.photo || ok === false) return null
  return (
    <div style={{
      width: u(size), height: u(size), borderRadius: '50%', flexShrink: 0, backgroundImage: `url("${agent.photo}")`, backgroundSize: 'cover',
      backgroundPosition: agent.pos ? `${agent.pos.x}% ${agent.pos.y}%` : '50% 30%', boxShadow: `0 0 0 ${hair} ${ring}`,
    }} />
  )
}

// Little line icons in front of the numbers (lucide smartphone / building-2) - inline SVG, so the
// server and browser exports keep them.
function TelIcon({ kind }: { kind: 'mobile' | 'office' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: '0.92em', height: '0.92em', flexShrink: 0, opacity: 0.8 }}>
      {kind === 'mobile'
        ? <><rect width="14" height="20" x="5" y="2" rx="2.5" /><path d="M12 18h.01" /></>
        : <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4M10 10h4M10 14h4M10 18h4" /></>}
    </svg>
  )
}
function Tel({ kind, num, style }: { kind: 'mobile' | 'office'; num: string; style?: CSSProperties }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38em', whiteSpace: 'nowrap', ...style }}><TelIcon kind={kind} />{num}</span>
}

// Who it's from (user + advertising rules, 10/09): the name in bold, the brokerage on its own bold
// line that is NEVER smaller than the name (a long brokerage steps the name down with it, and wraps
// rather than ever being cut), then the mobile and - on print - the brokerage office line, each
// with its little icon.
function AgentCard({ c, t, ink, S, align = 'left', variant = 'row', sel, showContact = true, scale = 1, narrow = false, showPhoto = true, noTitle = false, fitLong = false }: {
  fitLong?: boolean // footers with room to wrap: a long name / brokerage wraps to two lines instead of shrinking
  c: Content; t: DesignTheme; ink: Ink; S: Sizes; align?: 'left' | 'center'; variant?: 'row' | 'stack'; sel: Sel; showContact?: boolean; scale?: number
  noTitle?: boolean // just the name + brokerage (the letter footer: two lines beside two lines of contact)
  narrow?: boolean // tight columns: name, brokerage and one contact item (no title)
  showPhoto?: boolean
}) {
  const a = c.agent
  if (!a || (!a.name && !a.brokerage && !a.photo)) return null
  const lux = t.styleId === 'modern_luxury'
  const nameFont = lux || t.styleId === 'editorial' ? t.fonts.display : t.fonts.body
  const upper = lux || t.styleId === 'bold'
  const nameBase = S.agentName * scale * (lux ? 0.92 : 1)
  const nameFit = c.hanger && narrow
    ? fit(a.name, nameBase, upper ? (showPhoto ? 13 : 16) : (showPhoto ? 14 : 18), 0.6)
    : narrow ? nameBase : fit(a.name, nameBase, upper ? 16 : 20, 0.55)
  // print (user 10/12): a long name or brokerage wraps to two balanced lines instead of shrinking to a
  // whisper - sized so each line fits even the narrowest footer column (~19 characters at full size)
  const nameWraps = c.isPrint && fitLong && !narrow && (((a.name || '').length > 22) || ((a.brokerage || '').length > 30))
  const twoLineK = (x: string | null | undefined) => x ? Math.max(0.62, Math.min(1, 19 / Math.max(...splitLines(x, 2).map(l => l.length)))) : 1
  const wrapSize = nameBase * Math.min(twoLineK(a.name), twoLineK(a.brokerage))
  const brokerFit = a.brokerage ? (nameWraps ? wrapSize : fit(a.brokerage, nameBase, narrow ? (showPhoto ? 16 : 20) : 28, 0.6)) : nameFit
  // Print: the name and the brokerage are one matched pair - same bold sans, same size (user 10/09:
  // the thin serif name looked underwhelming next to a bold brokerage). Social keeps the theme's name font.
  const pair = c.isPrint
  const nameSize = pair ? (nameWraps ? wrapSize : Math.min(fit(a.name, nameBase, narrow ? (showPhoto ? 15 : 19) : 24, 0.6), brokerFit)) : Math.min(nameFit, brokerFit)
  const brokerSize = pair ? nameSize : Math.max(brokerFit, nameSize)
  const nameStyle: CSSProperties = {
    fontFamily: pair ? t.fonts.label : nameFont, fontWeight: pair ? 800 : nameFont === t.fonts.display ? 700 : 800,
    textTransform: pair ? 'none' : upper ? 'uppercase' : 'none',
    letterSpacing: pair ? '0' : lux ? (c.hanger && narrow ? '0.06em' : '0.12em') : t.styleId === 'bold' ? '0.04em' : '-0.005em',
    fontSize: u(nameSize), lineHeight: 1.15, color: ink.ink, whiteSpace: (narrow && !c.hanger) || nameWraps ? 'normal' : 'nowrap',
    ...(nameWraps ? { textWrap: 'balance' as CSSProperties['textWrap'] } : {}),
  }
  const strong = ink.onPhoto ? 'rgba(255,255,255,0.95)' : ink.ink
  const metaStyle: CSSProperties = { fontFamily: t.fonts.label, fontSize: u(S.agentMeta * scale), lineHeight: 1.4, color: ink.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const contactStyle: CSSProperties = { ...metaStyle, color: strong, fontWeight: 600, overflow: 'visible' }
  // Print (user 10/09): name, brokerage, then the email on its own line, then the numbers.
  const emailLine = pair && showContact ? a.email : ''
  const others = (pair ? (a.phone ? [] : [a.website]) : narrow ? (a.phone ? [] : [a.email || a.website]) : [a.email, a.website]).filter(Boolean) as string[]
  // door hangers are narrow (QR + headshot beside it) - the email stays at the width that fits there
  const emailCap = narrow ? (showPhoto ? (c.hanger ? 19.5 : 22) : (c.hanger ? 24 : 28)) : 36
  const emailParts = emailLine ? [emailLine] : []
  const emailSize = fit(emailParts.reduce((m, l) => (l.length > m.length ? l : m), ''), S.agentMeta * scale * 1.22, emailCap, 0.5)
  const stack = variant === 'stack'
  const centerText = stack && align === 'center'
  const fitPair = pair && nameWraps && (noTitle || !a.title)
  return (
    <Pick id={a.id} sel={sel} style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: stack ? (align === 'center' ? 'center' : 'flex-start') : 'center', gap: u(S.agentName * scale * (stack ? 0.7 : 0.9)), minWidth: 0 }}>
      {showPhoto && <Headshot agent={a} size={S.headshot * scale} ring={ink.onPhoto ? 'rgba(255,255,255,0.6)' : ink.accent} />}
      <div style={{ minWidth: 0, textAlign: centerText ? 'center' : 'left', display: 'flex', flexDirection: 'column', alignItems: centerText ? 'center' : 'flex-start' }}>
        {fitPair ? (
          // long name / brokerage: one matched pair, measured - as big as it can be while each wraps to at most two lines
          <FitLines text={`${a.name}|${a.brokerage}`} size={nameBase} lines={4} style={{ lineHeight: 1.18, textAlign: centerText ? 'center' : 'left' }} node={<>
            {a.name && <div style={{ ...nameStyle, fontSize: '1em', lineHeight: 1.18, whiteSpace: 'normal', textWrap: 'balance' as CSSProperties['textWrap'] }}>{a.name}</div>}
            {a.brokerage && <div style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: '1em', lineHeight: 1.18, color: strong, marginTop: '0.15em', textWrap: 'balance' as CSSProperties['textWrap'] }}>{a.brokerage}</div>}
          </>} />
        ) : a.name && (!narrow && !noTitle && a.title
          ? <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: u(S.agentMeta * scale * 0.7), justifyContent: centerText ? 'center' : 'flex-start' }}>
              <span style={nameStyle}>{a.name}</span>
              <span aria-hidden style={{ alignSelf: 'stretch', width: hair, background: ink.rule, margin: `${u(S.agentMeta * scale * 0.25)} 0` }} />
              <span style={{ ...metaStyle, overflow: 'visible' }}>{a.title}</span>
            </div>
          : <div style={nameStyle}>{a.name}</div>)}
        {!fitPair && a.brokerage && <div style={{ fontFamily: t.fonts.label, fontWeight: pair ? 700 : 800, fontSize: u(brokerSize), lineHeight: 1.18, color: strong, marginTop: u(S.agentMeta * scale * 0.2), whiteSpace: nameWraps || a.brokerage.length > (narrow ? 26 : 36) ? 'normal' : 'nowrap', textWrap: 'balance' as any }}>{a.brokerage}</div>}
        {showContact && (a.phone || others.length > 0 || (a.office && (!c.hanger || c.phonesInline))) && (
          <div style={{ ...contactStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: u(S.agentMeta * scale * 1.2), marginTop: u(S.agentMeta * scale * 0.2), justifyContent: centerText ? 'center' : 'flex-start' }}>
            {a.phone && <Tel kind="mobile" num={a.phone} />}
            {a.office && (!c.hanger || c.phonesInline) && <Tel kind="office" num={a.office} style={{ fontWeight: 500 }} />}
            {others.map(o => <span key={o} style={{ fontWeight: 500 }}>{o}</span>)}
          </div>
        )}
        {showContact && a.office && c.hanger && !c.phonesInline && <Tel kind="office" num={a.office} style={{ ...metaStyle, color: strong, overflow: 'visible' }} />}
        {emailLine && <div style={{ ...metaStyle, fontSize: u(emailSize), color: strong, fontWeight: 600, overflow: 'visible', marginTop: u(S.agentMeta * scale * 0.1) }}>{emailParts.map((l, i) => <div key={i}>{l}</div>)}</div>}
      </div>
    </Pick>
  )
}

// The letter footer's right side (user 10/11): the mobile number large, the office and the email under
// it, all set right so the footer spans the page.
function SplitContacts({ c, t, ink, S, sel, scale = 1, splitMail = false, center = false }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; scale?: number; splitMail?: boolean; center?: boolean }) {
  const a = c.agent
  if (!a || (!a.phone && !a.office && !a.email && !a.website)) return null
  const strong = ink.onPhoto ? 'rgba(255,255,255,0.95)' : ink.ink
  const base: CSSProperties = { fontFamily: t.fonts.label, color: strong, whiteSpace: 'nowrap', lineHeight: 1.3, fontVariantNumeric: 'lining-nums' }
  const mail = a.email || a.website || ''
  return (
    <Pick id={a.id} sel={sel} style={{ flex: splitMail ? '0 0 auto' : '0 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-end', textAlign: center ? 'center' : 'right', gap: u(S.agentMeta * scale * 0.3) }}>
      {mail && (() => {
        // roomy footers (user 10/13): the email stays on ONE line and barely shrinks - the name column wraps instead
        return <div style={{ ...base, fontWeight: 700, fontSize: u(fit(mail, S.agentMeta * scale * 1.4, splitMail ? 40 : 26, splitMail ? 0.84 : 0.6)) }}>{mail}</div>
      })()}
      {(a.phone || a.office) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: u(S.agentMeta * scale * 1.1) }}>
          {a.phone && <Tel kind="mobile" num={a.phone} style={{ ...base, fontWeight: 700, fontSize: u(S.agentMeta * scale * 1.4), letterSpacing: '0.02em' }} />}
          {a.office && <Tel kind="office" num={a.office} style={{ ...base, fontWeight: 500, fontSize: u(S.agentMeta * scale * 1.3) }} />}
        </div>
      )}
    </Pick>
  )
}

// Logos come in every shape. `height` is the budget for a typical wide brokerage mark; a square or
// tall mark (a monogram, a crest) gets more height so it never shrinks to a dot. The aspect is read
// from the image once it loads (cached per URL): the first paint uses the wide budget and settles a
// frame later - the export waits for every image, so it always captures the final size.
const LOGO_ASPECTS = new Map<string, number>()
function useImageAspect(src: string | null): number | null {
  const [aspect, setAspect] = useState<number | null>(() => (src && LOGO_ASPECTS.get(src)) || null)
  useEffect(() => {
    if (!src) return
    const known = LOGO_ASPECTS.get(src)
    if (known) { setAspect(known); return }
    let alive = true
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return
      const a = img.naturalWidth / img.naturalHeight
      LOGO_ASPECTS.set(src, a)
      if (alive) setAspect(a)
    }
    img.src = src
    return () => { alive = false }
  }, [src])
  return aspect
}

function Logo({ c, t, ink, height, maxWidth, chip }: { c: Content; t: DesignTheme; ink: Ink; height: number; maxWidth?: number; chip?: boolean }) {
  const aspect = useImageAspect(c.logo)
  if (!c.logo) return null
  const k = c.logoScale || 1
  const tallish = aspect !== null && aspect < 1.5
  const h = height * k * (tallish ? (aspect! < 0.9 ? 2.2 : 1.75) : 1)
  const w = Math.max((maxWidth || height * 3.6) * k, tallish ? h * 1.1 : 0)
  // Most brokerage logos are dark marks on transparent - on a photo or a dark panel they vanish, so
  // they sit on a small white card there.
  const needsChip = chip ?? (ink.onPhoto || t.isDark)
  const img = <img src={c.logo} alt="" crossOrigin="anonymous" style={{ display: 'block', maxHeight: u(h), maxWidth: u(w), width: 'auto', height: 'auto' }} />
  if (!needsChip) return img
  return <div style={{ background: '#fff', padding: `${u(height * 0.22)} ${u(height * 0.34)}`, borderRadius: u(height * 0.12), display: 'inline-flex', flexShrink: 0 }}>{img}</div>
}

// The site-wide QR look (lib/qrStyle): rounded modules, rounded eyes + a house mark in the theme's
// accent (darkened until scanners read it), error correction H.
function QrSvg({ url, eye }: { url: string; eye?: string }) {
  const parts = useMemo(() => styledQrSvg(url, { eye }), [url, eye])
  if (!parts) return null
  return <svg viewBox={`0 0 ${parts.size} ${parts.size}`} style={{ display: 'block', width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: parts.body }} />
}

function Qr({ c, t, ink, size, sel, labelSide = 'right', labelWidth }: { c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; labelSide?: 'right' | 'below' | 'none'; labelWidth?: number }) {
  if (!c.qr) return null
  const pad = size * 0.08
  return (
    <Pick id={c.qr.id} sel={sel} style={{ display: 'flex', flexDirection: labelSide === 'below' ? 'column' : 'row', alignItems: 'center', gap: u(size * 0.14), flexShrink: 0 }}>
      <div data-qr-box="" style={{ width: u(size), height: u(size), padding: u(pad), background: '#fff', borderRadius: u(size * 0.06), boxSizing: 'border-box', flexShrink: 0, boxShadow: ink.onPhoto ? '0 0.4cqmin 1.6cqmin rgba(0,0,0,0.25)' : `0 0 0 ${hair} ${ink.rule}` }}>
        <QrSvg url={c.qr.url} eye={t.accent} />
      </div>
      {labelSide !== 'none' && c.qr.label && (
        <div style={{
          fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: u(size * 0.092), lineHeight: 1.35,
          color: ink.ink, maxWidth: u(labelWidth || size * 0.95), textAlign: labelSide === 'below' ? 'center' : 'left',
        }}>
          {c.qr.label}
        </div>
      )}
    </Pick>
  )
}

function EhoMark({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size), flexShrink: 0 }} aria-label="Equal Housing Opportunity">
      <path d="M12 2.5 1.5 10.2V12h2v9.5h17V12h2v-1.8L12 2.5Zm6.5 17h-13v-8.8L12 5.9l6.5 4.8v8.8Z" fill={color} />
      <rect x="8" y="11.6" width="8" height="1.8" fill={color} />
      <rect x="8" y="15" width="8" height="1.8" fill={color} />
    </svg>
  )
}

function FinePrint({ c, ink, t, size, align = 'left', style, oneLine }: { c: Content; ink: Ink; t: DesignTheme; size: number; align?: 'left' | 'center'; style?: CSSProperties; oneLine?: boolean }) {
  if (!c.finePrint) return null
  const showEho = /equal housing/i.test(c.finePrint)
  // Door hanger: one line across (user review 10/09) - the type steps down to fit the 4.25in width.
  const one = c.hanger || oneLine
  const fs = c.hanger ? Math.min(size, (78 - (showEho ? size * 2.4 : 0)) / (c.finePrint.length * 0.4)) : size
  return (
    <Pick id={c.agent?.id} sel={{}} style={{ display: 'flex', alignItems: 'center', gap: u(size * 0.7), justifyContent: align === 'center' ? 'center' : 'flex-start', ...style }}>
      {showEho && <EhoMark size={size * 1.7} color={ink.muted} />}
      {oneLine && !c.hanger
        ? <div style={{ flex: 1, minWidth: 0 }}><FitLines text={c.finePrint} size={size} lines={1} style={{ fontFamily: t.fonts.body, lineHeight: 1.35, color: ink.muted, textAlign: align }} /></div>
        : <div style={{ fontFamily: t.fonts.body, fontSize: u(fs), lineHeight: 1.35, color: ink.muted, textAlign: align, ...(one ? { whiteSpace: 'nowrap' } : {}) }}>{c.finePrint}</div>}
    </Pick>
  )
}

// The old default QR words, shortened (user review 10/09) - saved designs that still carry the
// default read the new one too; anything the agent typed themselves is left alone.
const qrWords = (label: string) => (/^scan for photos (&|and) details$/i.test(label.trim()) ? 'Scan for details' : label)

// Door hangers: QR + who to call, side by side - the narrow format can't afford a separate row each.
function ContactBlock({ c, t, ink, S, sel, align, qrLabel = true }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; align: 'left' | 'center'; qrLabel?: boolean }) {
  if (!c.qr) return <AgentCard c={c} t={t} ink={ink} S={S} sel={sel} align={align} variant={align === 'center' ? 'stack' : 'row'} narrow />
  const a = c.agent
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(S.gap * 1.1), width: '100%' }}>
      <Qr c={c} t={t} ink={ink} size={S.qr} sel={sel} labelSide="none" />
      <div style={{ minWidth: 0, flex: '0 1 auto', display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.45) }}>
        {qrLabel && c.qr.label && <Pick id={c.qr.id} sel={sel}><div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: t.label.tracking, fontSize: u(fit(c.qr.label, S.agentMeta * 0.95, 18, 0.62)), color: ink.accent, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{c.qr.label}</div></Pick>}
        {a && <AgentCard c={c} t={t} ink={ink} S={{ ...S, headshot: S.headshot * 1.22 }} sel={sel} narrow showPhoto={!!a.photo} scale={0.92} />}
      </div>
    </div>
  )
}

function PriceFactsRow({ c, t, ink, S, align, sel }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; align: 'left' | 'center'; sel: Sel }) {
  const facts = c.details.find(d => d.kind === 'facts') as Extract<DetailItem, { kind: 'facts' }> | undefined
  if (!c.price && !facts) return null
  const color = t.styleId === 'editorial' || t.styleId === 'bold' ? ink.accent : ink.ink
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap), justifyContent: align === 'center' ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
      {c.price && (
        <Pick id={c.price.id} sel={sel}>
          <div style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(S.price * 0.72 * t.price.scale * c.price.o.k), lineHeight: 1, color, ...c.price.o.css }}>{c.price.value}</div>
        </Pick>
      )}
      {c.price && facts && <Rule color={ink.rule} vertical />}
      {facts && <Pick id={facts.id} sel={sel}><Facts items={facts.items} t={t} ink={ink} size={S.facts * 0.9} align={align} variant="inline" o={facts.o} /></Pick>}
    </div>
  )
}

function LuxFrame({ t, ink, inset }: { t: DesignTheme; ink: Ink; inset: number }) {
  if (!t.frame) return null
  return <div style={{ position: 'absolute', inset: u(inset), border: `${hair} solid ${ink.onPhoto ? 'rgba(255,255,255,0.45)' : ink.accent}`, opacity: ink.onPhoto ? 1 : 0.7, pointerEvents: 'none', zIndex: 3 }} />
}

// ---------------------------------------------------------------------------------------------
// The primary text group - kicker, title, sub, price - shared by most compositions.
// ---------------------------------------------------------------------------------------------
function Headline({ c, t, ink, S, align, sel, maxChars, showKicker = true, showPrice = true, priceInline = false, kickerText, compact = false, oneLine = false }: {
  c: Content; t: DesignTheme; ink: Ink; S: Sizes; align: 'left' | 'center'; sel: Sel; maxChars?: number; showKicker?: boolean; showPrice?: boolean; priceInline?: boolean; kickerText?: string
  compact?: boolean // price + facts share a single row (email banners, postcard info bands)
  oneLine?: boolean // keep the title on a single line (email banners)
}) {
  const kick = kickerText ?? c.kicker?.text
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.85), alignItems: align === 'center' ? 'center' : 'stretch' }}>
      {showKicker && kick && <Pick id={c.kicker?.id} sel={sel}><Kicker text={kick} t={t} ink={ink} size={S.kicker} align={align} o={kickerText ? undefined : c.kicker?.o} /></Pick>}
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.45), width: '100%' }}>
          <Title text={c.title.text} t={t} ink={ink} size={c.title.isAddress ? S.title : S.title * 1.05} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={maxChars ?? (compact ? 26 : c.title.isAddress ? 20 : 30)} style={oneLine ? { textWrap: 'balance' as any } : undefined} />
          {c.sub && (c.title.isAddress
            ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub} align={align} />
            : <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.08} align={align} style={{ marginTop: u(S.gap * 0.3), display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />)}
        </Pick>
      )}
      {compact && <PriceFactsRow c={c} t={t} ink={ink} S={S} align={align} sel={sel} />}
      {!compact && showPrice && c.price && !priceInline && (
        <Pick id={c.price.id} sel={sel} style={{ marginTop: u(S.gap * 0.2) }}>
          <Price price={c.price} t={t} ink={ink} size={S.price} align={align} />
        </Pick>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Compositions
// ---------------------------------------------------------------------------------------------
interface CompProps { c: Content; t: DesignTheme; fam: DesignFamily; S: Sizes; sel: Sel; ar?: number }

// Door hangers are die-cut with a hanger hole centered near the top (~1.25" circle, ~0.5" down on a
// 4.25" wide piece). Nothing important may sit in that zone - only photo or plain background.
const HANGER_ZONE = 42

const alignItems = (align: 'left' | 'center') => (align === 'center' ? 'center' : 'stretch')

function scrimFor(t: DesignTheme, fam: DesignFamily, strength = 1, low = false): string {
  const s = t.scrim
  const a = (v: number) => Math.min(0.97, v * strength * (low ? 0.86 : 1))
  if (low && fam !== 'landscape' && fam !== 'banner') {
    // Town only: a shorter story, so the fade stops lower and lighter.
    // Dark type on a light fade needs it fuller behind the words - it only starts a little lower.
    if (!t.isDark) return `linear-gradient(0deg, rgba(${s},${a(1.1)}) 0%, rgba(${s},${a(1.04)}) 22%, rgba(${s},${a(0.8)}) 40%, rgba(${s},${a(0.24)}) 54%, rgba(${s},0) 62%)`
    return [
      `linear-gradient(0deg, rgba(${s},${a(0.92)}) 0%, rgba(${s},${a(0.74)}) 18%, rgba(${s},${a(0.4)}) 34%, rgba(${s},${a(0.08)}) 48%, rgba(${s},0) 56%)`,
      `linear-gradient(180deg, rgba(${s},${a(0.36)}) 0%, rgba(${s},0) 16%)`,
    ].join(', ')
  }
  if (fam === 'landscape' || fam === 'banner') {
    return [
      `linear-gradient(90deg, rgba(${s},${a(0.9)}) 0%, rgba(${s},${a(0.74)}) 30%, rgba(${s},${a(0.3)}) 56%, rgba(${s},0) 74%)`,
      `linear-gradient(0deg, rgba(${s},${a(0.55)}) 0%, rgba(${s},0) 42%)`,
    ].join(', ')
  }
  if (!t.isDark) {
    // Paper fade (light themes): stronger behind the type - dark text on a bright photo needs the
    // detail calmed more than white text on a darkened one - and no haze over the sky up top.
    return `linear-gradient(0deg, rgba(${s},${a(0.96)}) 0%, rgba(${s},${a(0.9)}) 24%, rgba(${s},${a(0.66)}) 44%, rgba(${s},${a(0.2)}) 60%, rgba(${s},0) 70%)`
  }
  return [
    `linear-gradient(0deg, rgba(${s},${a(0.94)}) 0%, rgba(${s},${a(0.82)}) 26%, rgba(${s},${a(0.52)}) 50%, rgba(${s},${a(0.12)}) 68%, rgba(${s},0) 78%)`,
    `linear-gradient(180deg, rgba(${s},${a(0.5)}) 0%, rgba(${s},0) 20%)`,
  ].join(', ')
}

// The standard sign-off: hairline, agent + QR, fine print. Door hangers use the compact
// side-by-side ContactBlock instead.
function Footer({ c, t, ink, S, sel, align, fam, narrow = false, qrLabel = true, qrScale = 1, agentScale = 1, rule = true, fineOneLine = false }: {
  c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; align: 'left' | 'center'; fam: DesignFamily
  narrow?: boolean; qrLabel?: boolean; qrScale?: number; agentScale?: number; rule?: boolean; fineOneLine?: boolean
}) {
  if (!c.agent && !c.qr && !c.finePrint) return null
  return (
    <div data-foot="" style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8), width: '100%', flexShrink: 0 }}>
      {rule && (c.agent || c.qr) && <Rule color={ink.rule} />}
      {fam === 'tall' ? (
        <ContactBlock c={c} t={t} ink={ink} S={S} sel={sel} align={align} qrLabel={qrLabel} />
      ) : fam === 'portrait' && c.isPrint && c.agent ? (
        // letters / flyers (user 10/11, every theme): the footer spans the page like the social posts -
        // the agent on the left, the numbers + email set right, the QR (when it lives here) at the end
        <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.2) }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}><AgentCard c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={agentScale * 1.08} showContact={false} noTitle /></div>
          <SplitContacts c={c} t={t} ink={ink} S={S} sel={sel} scale={agentScale} />
          {c.qr && <><span aria-hidden style={{ alignSelf: 'stretch', width: hair, background: ink.rule, flexShrink: 0 }} /><Qr c={c} t={t} ink={ink} size={S.qr * qrScale * (qrLabel ? 0.85 : 0.92)} sel={sel} labelSide={qrLabel ? 'below' : 'none'} labelWidth={S.qr * qrScale * 1.1} /></>}
        </div>
      ) : (c.agent || c.qr) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'center' && !c.qr ? 'center' : 'space-between', gap: u(S.gap) }}>
          <AgentCard c={c} t={t} ink={ink} S={S} sel={sel} align={align} narrow={narrow} scale={agentScale} />
          <Qr c={c} t={t} ink={ink} size={S.qr * qrScale} sel={sel} labelSide={qrLabel ? 'right' : 'none'} />
        </div>
      )}
      <FinePrint c={c} ink={ink} t={t} size={S.fine} align={align} oneLine={fineOneLine} />
    </div>
  )
}

function Cinematic({ c, t, fam, S: S0, sel }: CompProps) {
  if (socialFam(c, fam)) return <CinematicSocial c={c} t={t} fam={fam} S={S0} sel={sel} />
  let S = S0
  const onPhoto = inkDeep(t)
  const deepT = { ...t, isDark: true, scrim: deepTone(t) } // a deep, photo-grade fade in every theme
  const onBg = inkOnBg(t)
  const wide = fam === 'landscape' || fam === 'banner'
  const align: 'left' | 'center' = t.align === 'center' && !wide ? 'center' : 'left'
  const P = S.pad

  // Print portrait/tall: a cover photo with the title set over it, and a solid information band
  // underneath so price, facts and the QR stay crisp on paper.
  if (fam === 'portrait' || fam === 'tall') {
    const tall = fam === 'tall'
    const photoPct = c.leadGen ? (tall ? 74 : 72) : tall ? 55 : 62
    return (
      <>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%` }}>
          <div style={{ position: 'absolute', inset: 0, background: scrimFor(deepT, 'square', t.colorBlock ? 0.6 : 1) }} />
        </Photo>
        <LuxFrame t={t} ink={onPhoto} inset={P * 0.45} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%`, padding: u(P), display: 'flex', flexDirection: 'column', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Logo c={c} t={t} ink={onPhoto} height={S.agentName * (tall ? 1.3 : 2)} maxWidth={tall ? 24 : undefined} /></div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align) }}>
            {t.colorBlock ? (
              <div style={{ background: t.bg, padding: u(P * 0.6), maxWidth: '100%', alignSelf: 'flex-start' }}>
                <Headline c={c} t={t} ink={onBg} S={S} align="left" sel={sel} showPrice={false} />
              </div>
            ) : (
              <Headline c={c} t={t} ink={onPhoto} S={S} align={align} sel={sel} showPrice={false} />
            )}
            {tall && <Details c={c} t={t} ink={onPhoto} S={S} align={align} sel={sel} only={['openHouse']} />}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${100 - photoPct}%`, background: t.bg, padding: `${u(P * 0.8)} ${u(P)} ${u(P * 0.7)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap), zIndex: 2 }}>
          <div style={{ display: 'flex', flexDirection: tall || align === 'center' ? 'column' : 'row', alignItems: tall || align === 'center' ? (align === 'center' ? 'center' : 'flex-start') : 'flex-end', justifyContent: 'space-between', gap: u(S.gap) }}>
            {c.price && <Pick id={c.price.id} sel={sel}><Price price={c.price} t={t} ink={onBg} size={S.price} align={align} /></Pick>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8), alignItems: align === 'center' ? 'center' : 'flex-start' }}>
              <Details c={c} t={t} ink={onBg} S={S} align={align} sel={sel} only={tall ? ['facts'] : ['facts', 'openHouse']} />
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align) }}>
            <Details c={c} t={t} ink={onBg} S={S} align={align} sel={sel} only={['description', 'highlights', 'cta']} clamp={3} />
          </div>
          <Footer c={c} t={t} ink={onBg} S={S} sel={sel} align={align} fam={fam} />
        </div>
      </>
    )
  }

  const banner = fam === 'banner'
  if (fam === 'landscape') S = scaled(S, c.isPrint ? 0.8 : 0.88)
  if (banner && t.colorBlock) S = scaled(S, 0.8)
  const storyTop = fam === 'story' ? 19 : P
  const storyBottom = fam === 'story' ? 17 : P
  const textMax = banner ? '60%' : wide ? '62%' : '100%'
  const detailVariants = { facts: (fam === 'landscape' && c.isPrint ? 'inline' : 'stats') as 'inline' | 'stats' }
  const detailOnly: DetailItem['kind'][] | undefined = banner ? ['openHouse', 'cta'] : undefined
  const boxed = t.colorBlock && (c.isPrint || banner)
  const headline = boxed ? (
    <div style={{ background: t.bg, padding: u(P * 0.62), display: 'flex', flexDirection: 'column', gap: u(S.gap), maxWidth: wide ? '100%' : '94%', alignSelf: 'flex-start' }}>
      <Headline c={c} t={t} ink={onBg} S={S} align="left" sel={sel} compact={banner} oneLine={banner} />
      <Details c={c} t={t} ink={onBg} S={S} align="left" sel={sel} only={detailOnly} variants={detailVariants} clamp={fam === 'story' ? 4 : 2} />
    </div>
  ) : (
    <>
      <Headline c={c} t={t} ink={onPhoto} S={S} align={align} sel={sel} compact={banner} oneLine={banner} />
      <Details c={c} t={t} ink={onPhoto} S={S} align={align} sel={sel} only={detailOnly} variants={detailVariants} clamp={fam === 'story' ? 4 : 2} />
    </>
  )

  // The sign-off sits on a solid band in the theme's own color, so every color theme reads
  // distinctly even though the photo fills the frame (Bold already floods its title block instead).
  const band = !banner && !boxed && !!(c.agent || c.qr || c.finePrint)
  // Social posts sign off with the full-width AgentBar (it carries the logo too); print keeps
  // the Footer for its QR code and fine print.
  const socialBar = !c.isPrint && !banner
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, background: scrimFor(deepT, fam, boxed ? 0.55 : 1, c.townOnly), pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, padding: `${u(storyTop)} ${u(P)} ${u(band ? P * (c.townOnly ? 0.42 : 0.85) : storyBottom)}`, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: align === 'center' ? 'center' : 'flex-end', position: 'relative' }}>
              {!socialBar && <Logo c={c} t={t} ink={onPhoto} height={S.agentName * (banner ? 1.5 : 1.9)} />}
            </div>
            <div style={{ marginTop: 'auto', maxWidth: textMax, display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1), alignItems: alignItems(align), alignSelf: align === 'center' ? 'center' : 'stretch', width: align === 'center' ? '100%' : undefined }}>
              {headline}
            </div>
            {!band && (
              <div style={{ marginTop: u(S.gap * 1.3), width: banner ? textMax : '100%' }}>
                {socialBar ? (
                  <div style={{ borderTop: `${hair} solid ${hexA(onPhoto.ink, 0.4)}`, paddingTop: u(S.gap * 0.8), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
                    <AgentBar c={c} t={t} ink={onPhoto} S={S} sel={sel} fam={fam} />
                    {c.leadGen && <FinePrint c={c} ink={onPhoto} t={t} size={S.fine} />}
                  </div>
                ) : (
                  <Footer c={c} t={t} ink={onPhoto} S={S} sel={sel} align={align} fam={fam} narrow={banner} agentScale={banner ? 0.72 : 1} qrLabel={fam !== 'story'} />
                )}
              </div>
            )}
          </div>
        </div>
        {band && (
          <div style={{ background: t.bg, padding: `${u(P * 0.6)} ${u(P)} ${u(fam === 'story' ? 12 : P * 0.6)}`, position: 'relative', zIndex: 2 }}>
            {socialBar ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
                <AgentBar c={c} t={t} ink={onBg} S={S} sel={sel} fam={fam} />
                {c.leadGen && <FinePrint c={c} ink={onBg} t={t} size={S.fine} />}
              </div>
            ) : (
              <Footer c={c} t={t} ink={onBg} S={S} sel={sel} align={align} fam={fam} rule={false} qrLabel={fam !== 'story' && !wide} qrScale={0.85} />
            )}
          </div>
        )}
      </div>
      <LuxFrame t={t} ink={band ? onBg : onPhoto} inset={P * 0.45} />
    </>
  )
}

function Horizon({ c, t, fam, S: S0, sel }: CompProps) {
  if (socialFam(c, fam)) return <HorizonSocial c={c} t={t} fam={fam} S={S0} sel={sel} />
  if (c.isPrint || fam === 'portrait' || fam === 'tall' || fam === 'banner') return <Cinematic c={c} t={t} fam={fam} S={S0} sel={sel} />
  const wide = fam === 'landscape'
  const story = fam === 'story'
  const S = wide ? scaled(S0, 0.88) : S0
  const onPhoto = inkOnPhoto(t)
  const onBg = inkOnBg(t)
  const P = S.pad
  const facts = findFacts(c)
  const priceColor = t.styleId === 'editorial' || t.styleId === 'bold' ? onPhoto.accent : onPhoto.ink
  const bottomPad = c.townOnly ? (story ? P * 0.6 : P * 0.45) : story ? P * 1.2 : P * 0.75
  // Set low and kept short: the words on the left, the price over the facts on the right, so the
  // photo keeps most of the frame instead of the details climbing up it.
  const priceBlock = c.price && (
    <Pick id={c.price.id} sel={sel} style={{ flexShrink: 0 }}>
      {c.price.label && <div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.facts * 0.58), color: onPhoto.muted, marginBottom: u(S.facts * 0.3), whiteSpace: 'nowrap', textAlign: story ? 'left' : 'right' }}>{c.price.label}</div>}
      <div style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(S.price * (story ? 0.82 : 0.78) * t.price.scale * c.price.o.k), lineHeight: 1, color: priceColor, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', textAlign: story ? 'left' : 'right', ...c.price.o.css }}>{c.price.value}</div>
      {c.price.previous && <div style={{ fontFamily: t.fonts.label, fontSize: u(S.facts * 0.58), color: onPhoto.muted, marginTop: u(S.facts * 0.25), textDecoration: 'line-through', whiteSpace: 'nowrap', textAlign: story ? 'left' : 'right' }}>{c.price.previous}</div>}
    </Pick>
  )
  const words = (
    <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.42) }}>
      {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={onPhoto} size={S.kicker * 0.88} align="left" o={c.kicker.o} /></Pick>}
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.28) }}>
          <Title text={c.title.text} t={t} ink={onPhoto} size={S.title * (story ? 0.8 : 0.7)} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={story ? 18 : 20} />
          {c.sub && <Sub text={c.sub.text} t={t} ink={onPhoto} size={S.sub * 0.92} align="left" />}
        </Pick>
      )}
      <Details c={c} t={t} ink={onPhoto} S={scaled(S, 0.9)} align="left" sel={sel} only={['openHouse', 'cta']} />
    </div>
  )
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: (() => {
            const k = c.townOnly && t.isDark ? 0.8 : 1 // town only: the fade reaches less far up the photo (dark type on light themes keeps it)
            const st = (n: number) => `${Math.round(n * k)}%`
            const a = (v: number) => (c.townOnly && t.isDark ? v * 0.9 : v)
            return t.isDark
              ? `linear-gradient(0deg, rgba(${t.scrim},${a(0.9)}) 0%, rgba(${t.scrim},${a(0.62)}) ${st(story ? 22 : 18)}, rgba(${t.scrim},${a(0.16)}) ${st(story ? 40 : 34)}, rgba(${t.scrim},0) ${st(story ? 52 : 46)})`
              : `linear-gradient(0deg, rgba(${t.scrim},${a(0.97)}) 0%, rgba(${t.scrim},${a(0.86)}) ${st(story ? 22 : 18)}, rgba(${t.scrim},${a(0.3)}) ${st(story ? 40 : 34)}, rgba(${t.scrim},0) ${st(story ? 52 : 46)})`
          })() }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `0 ${u(P)} ${u(bottomPad)}`, zIndex: 2 }}>
            {story ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.7) }}>
                {words}
                {(c.price || facts) && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: u(S.gap * 1.2), borderTop: `${hair} solid ${hexA(onPhoto.ink, 0.32)}`, paddingTop: u(S.gap * 0.7) }}>
                    {priceBlock}
                    {facts && <Pick id={facts.id} sel={sel}><Facts items={facts.items} t={t} ink={onPhoto} size={S.facts * 0.86} align="left" o={facts.o} /></Pick>}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(S.gap * 1.4) }}>
                {words}
                {(c.price || facts) && (
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: u(S.gap * 0.5), borderLeft: `${hair} solid ${hexA(onPhoto.ink, 0.32)}`, paddingLeft: u(S.gap * 1.2), maxWidth: wide ? '40%' : '46%' }}>
                    {priceBlock}
                    <FactsLine c={c} t={t} ink={onPhoto} size={S.facts * 0.82} sel={sel} weight={600} nowrap />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {(c.agent || c.logo) && (
          <div style={{ background: t.bg, padding: `${u(P * 0.6)} ${u(P)} ${u(story ? 12 : P * 0.6)}`, position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
            <AgentBar c={c} t={t} ink={onBg} S={S} sel={sel} fam={fam} />
            {c.leadGen && <FinePrint c={c} ink={onBg} t={t} size={S.fine} />}
          </div>
        )}
      </div>
      <LuxFrame t={t} ink={c.agent || c.logo ? onBg : onPhoto} inset={P * 0.45} />
    </>
  )
}

function Framed({ c, t, fam, S, sel }: CompProps) {
  const ink = inkOnBg(t)
  const P = S.pad
  const align = t.align
  const wide = fam === 'landscape' || fam === 'banner'
  const banner = fam === 'banner'
  const radius = t.photoRadius
  const gallery = c.photos.slice(1, fam === 'portrait' ? 4 : 3)

  if (wide) {
    const photoW = banner ? 40 : 50
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
        <LuxFrame t={t} ink={ink} inset={P * 0.4} />
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} radius={radius} style={{ position: 'absolute', top: u(P), bottom: u(P), right: u(P), width: `calc(${photoW}% - ${u(P)})` }} />
        <div style={{ position: 'absolute', top: u(P), bottom: u(P * 0.9), left: u(P * 1.1), width: `calc(${100 - photoW}% - ${u(P * 2.3)})`, display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align), zIndex: 2 }}>
          {!banner && c.logo && <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.7} /></div>}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'safe center', gap: u(S.gap * 1.1), width: '100%', alignItems: alignItems(align) }}>
            <Headline c={c} t={t} ink={ink} S={S} align={align} sel={sel} compact={banner} oneLine={banner} />
            <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={banner ? ['openHouse', 'cta'] : undefined} variants={{ facts: align === 'center' ? 'inline' : 'stats' }} clamp={2} />
          </div>
          <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} narrow={banner || !!c.qr} agentScale={banner ? 0.72 : 0.95} qrLabel={false} qrScale={0.9} rule={!banner} />
        </div>
      </>
    )
  }

  // Portrait / square / story / tall: photo inset on top like a gallery print, type underneath.
  const tall = fam === 'tall'
  const photoPct = fam === 'square' ? (align === 'center' ? 47 : 55) : fam === 'story' ? 50 : tall ? 30 : 44
  const topPad = fam === 'story' ? 17 : tall ? HANGER_ZONE : P
  const bottomPad = fam === 'story' ? 15 : P * 0.85
  const galleryH = fam === 'portrait' ? 11 : tall ? 7 : 0
  const showGallery = gallery.length > 0 && galleryH > 0
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
      <LuxFrame t={t} ink={ink} inset={P * 0.42} />
      {tall && c.logo && <div style={{ position: 'absolute', top: u(P * 0.8), right: u(P * 0.8), zIndex: 3 }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.2} maxWidth={24} /></div>}
      <div style={{ position: 'absolute', inset: 0, padding: `${u(topPad)} ${u(P)} ${u(bottomPad)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.15), zIndex: 2 }}>
        <div style={{ height: `${photoPct}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: u(P * 0.18) }}>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} radius={radius} style={{ flex: 1 }}>
            {!tall && c.logo && align !== 'center' && <div style={{ position: 'absolute', top: u(P * 0.4), right: u(P * 0.4) }}><Logo c={c} t={t} ink={inkOnPhoto(t)} height={S.agentName * 1.6} /></div>}
          </Photo>
          {showGallery && (
            <Pick id={c.galleryId} sel={sel} style={{ height: `${galleryH / photoPct * 100}%`, display: 'flex', gap: u(P * 0.18) }}>
              {gallery.map((p, i) => <Photo key={i} photo={p} t={t} sel={{}} radius={radius} style={{ flex: 1 }} />)}
            </Pick>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align) }}>
          {fam === 'square' && align !== 'center' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: u(S.gap * 1.5) }}>
              <div style={{ flex: 1, minWidth: 0 }}><Headline c={c} t={t} ink={ink} S={S} align="left" sel={sel} showPrice={false} maxChars={18} /></div>
              {c.price && <Pick id={c.price.id} sel={sel} style={{ flexShrink: 0 }}><Price price={c.price} t={t} ink={ink} size={S.price} align="left" /></Pick>}
            </div>
          ) : (
            <Headline c={c} t={t} ink={ink} S={S} align={align} sel={sel} />
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align), width: '100%' }}>
            <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} variants={{ facts: fam === 'square' ? 'inline' : 'stats', openHouse: tall ? 'hero' : 'line' }} clamp={fam === 'portrait' ? 4 : 3} />
          </div>
          <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} qrLabel={fam !== 'story'} />
        </div>
      </div>
    </>
  )
}

function Split({ c, t, fam, S: S0, sel, photoFirst = false }: CompProps & { photoFirst?: boolean }) {
  let S = S0
  const ink = inkOnBg(t)
  const P = S.pad
  const align = t.align
  const wide = fam === 'landscape' || fam === 'banner'
  const banner = fam === 'banner'
  const tab = t.kicker.treatment === 'block'

  if (wide || fam === 'square') {
    const photoW = banner ? 44 : fam === 'square' ? 50 : 54
    const photoLeft = fam === 'square' ? !photoFirst : photoFirst
    if (fam === 'square') S = scaled(S, 0.9)
    else if (c.isPrint) S = scaled(S, 0.84)
    else if (c.leadGen && fam === 'landscape') S = scaled(S, 0.88)
    const narrow = fam === 'square' || !!c.qr
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', top: 0, bottom: 0, [photoLeft ? 'left' : 'right']: 0, width: `${photoW}%` } as CSSProperties} />
        {t.styleId === 'bold' && <div style={{ position: 'absolute', top: 0, bottom: 0, [photoLeft ? 'left' : 'right']: `${photoW}%`, width: u(1.6), background: t.accent, zIndex: 2 } as CSSProperties} />}
        <div style={{ position: 'absolute', top: 0, bottom: 0, [photoLeft ? 'right' : 'left']: 0, width: `${100 - photoW}%`, padding: `${u(P)} ${u(P * 1.05)} ${u(P * 0.85)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align), zIndex: 2 } as CSSProperties}>
          <LuxFrame t={t} ink={ink} inset={P * 0.42} />
          {!banner && c.logo && <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.6} /></div>}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'safe center', gap: u(S.gap * 1.1), width: '100%', alignItems: alignItems(align) }}>
            <div style={{ width: '100%', minWidth: 0 }}><Headline c={c} t={t} ink={ink} S={S} align={align} sel={sel} maxChars={banner ? 18 : fam === 'square' ? 14 : 18} compact={banner} oneLine={banner} /></div>
            <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={banner ? ['openHouse', 'cta'] : undefined} variants={{ facts: c.isPrint || align === 'center' ? 'inline' : 'stats' }} clamp={2} />
          </div>
          <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} narrow={narrow || banner} qrLabel={false} qrScale={0.88} agentScale={banner ? 0.72 : 0.92} rule={!banner} />
        </div>
      </>
    )
  }

  // Vertical: photo edge-to-edge on top, a solid panel below with the kicker as a tab on the seam.
  const photoPct = fam === 'story' ? 56 : fam === 'tall' ? 46 : 52
  const kickerOnSeam = !!c.kicker && t.styleId !== 'modern_luxury'
  const topSafe = fam === 'story' ? 16 : 0
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%` }}>
        {topSafe > 0 && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(${t.scrim},0.45) 0%, rgba(${t.scrim},0) 28%)` }} />}
        {c.logo && <div style={{ position: 'absolute', top: u(Math.max(P * 0.6, topSafe * 0.55)), right: u(P * 0.6) }}><Logo c={c} t={t} ink={inkOnPhoto(t)} height={S.agentName * 1.6} maxWidth={fam === 'tall' ? 24 : undefined} /></div>}
      </Photo>
      {kickerOnSeam && (
        <div style={{ position: 'absolute', left: align === 'center' ? 0 : u(P), right: align === 'center' ? 0 : undefined, top: `${photoPct}%`, transform: 'translateY(-50%)', zIndex: 3, display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
          <Pick id={c.kicker!.id} sel={sel} style={{ background: tab ? 'transparent' : t.bg, padding: tab ? 0 : `${u(S.kicker * 0.55)} ${u(S.kicker * 1.1)}` }}>
            <Kicker text={c.kicker!.text} t={t} ink={ink} size={S.kicker} align={align} o={c.kicker!.o} />
          </Pick>
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${100 - photoPct}%`, padding: `${u(P * (kickerOnSeam ? 1.05 : 0.85))} ${u(P)} ${u(fam === 'story' ? 13 : P * 0.8)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align), zIndex: 2 }}>
        <LuxFrame t={t} ink={ink} inset={P * 0.42} />
        <Headline c={c} t={t} ink={ink} S={S} align={align} sel={sel} showKicker={!kickerOnSeam} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align), width: '100%' }}>
          <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} variants={{ facts: 'stats', openHouse: fam === 'tall' ? 'hero' : 'line' }} clamp={3} />
        </div>
        <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} qrLabel={fam !== 'story'} />
      </div>
    </>
  )
}

function Collage({ c, t, fam, S, sel }: CompProps) {
  const ink = inkOnBg(t)
  const P = S.pad
  const align = t.align
  const photos = c.photos
  const gap = u(Math.max(P * 0.12, 0.5))
  const kickerTab = (style: CSSProperties) => c.kicker && (
    <div style={{ position: 'absolute', zIndex: 3, ...style }}>
      <Pick id={c.kicker.id} sel={sel} style={{ background: t.kicker.treatment === 'block' ? 'transparent' : t.bg, padding: t.kicker.treatment === 'block' ? 0 : `${u(S.kicker * 0.5)} ${u(S.kicker * 1)}` }}>
        <Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker} align="left" o={c.kicker.o} />
      </Pick>
    </div>
  )

  if (fam === 'landscape' || fam === 'banner') {
    // Postcard/mailer: hero + two stacked supporting shots, a clean information band beneath.
    const side = photos.slice(1, 3)
    const Sb = scaled(S, c.details.some(d => d.kind === 'openHouse') ? 0.74 : 0.84)
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '58%', display: 'flex', gap }}>
          <Photo photo={photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ flex: side.length ? 2 : 1 }}>
            {kickerTab({ left: u(P * 0.6), top: u(P * 0.6) })}
          </Photo>
          {side.length > 0 && (
            <Pick id={c.galleryId} sel={sel} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap }}>
              {side.map((p, i) => <Photo key={i} photo={p} t={t} sel={{}} style={{ flex: 1 }} />)}
            </Pick>
          )}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', padding: `${u(P * 0.62)} ${u(P * 0.8)} ${u(P * 0.45)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5), zIndex: 2 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: u(S.gap * 1.4) }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(Sb.gap * 0.7) }}>
              <Headline c={c} t={t} ink={ink} S={Sb} align="left" sel={sel} showKicker={false} compact maxChars={18} />
              <Details c={c} t={t} ink={ink} S={Sb} align="left" sel={sel} only={['openHouse', 'cta']} />
            </div>
            <Rule color={ink.rule} vertical />
            <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap), flexShrink: 0, maxWidth: '44%' }}>
              <AgentCard c={c} t={t} ink={ink} S={Sb} sel={sel} narrow />
              <Qr c={c} t={t} ink={ink} size={S.qr * 0.78} sel={sel} labelSide="none" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: u(S.gap) }}>
            <FinePrint c={c} ink={ink} t={t} size={S.fine * 0.9} />
            <Logo c={c} t={t} ink={ink} height={S.agentName * 1.1} />
          </div>
        </div>
      </>
    )
  }

  if (fam !== 'portrait' && fam !== 'tall') return <Framed c={c} t={t} fam={fam} S={S} sel={sel} />

  // Flyer / door hanger: hero, a strip of supporting photos, then the full listing story.
  const tall = fam === 'tall'
  const strip = photos.slice(1, tall ? 3 : 4)
  const twoCol = fam === 'portrait' && align !== 'center'
  const stripDefault = tall ? 9 : twoCol ? 13 : 11
  const heroPct = (tall ? 33 : twoCol ? 42 : 37) + (strip.length ? 0 : stripDefault)
  const stripPct = strip.length ? stripDefault : 0
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
      <Photo photo={photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${heroPct}%` }}>
        {c.logo && <div style={{ position: 'absolute', top: u(P * 0.6), right: u(P * 0.6) }}><Logo c={c} t={t} ink={inkOnPhoto(t)} height={S.agentName * (tall ? 1.3 : 1.8)} maxWidth={tall ? 24 : undefined} /></div>}
      </Photo>
      {strip.length > 0 && (
        <Pick id={c.galleryId} sel={sel} style={{ position: 'absolute', left: 0, right: 0, top: `calc(${heroPct}% + ${gap})`, height: `calc(${stripPct}% - ${gap})`, display: 'flex', gap }}>
          {strip.map((p, i) => <Photo key={i} photo={p} t={t} sel={{}} style={{ flex: 1 }} />)}
        </Pick>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: `${heroPct + stripPct}%`, padding: `${u(P * 0.85)} ${u(P)} ${u(P * 0.7)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap), zIndex: 2 }}>
        <LuxFrame t={t} ink={ink} inset={P * 0.42} />
        {twoCol ? (
          <div style={{ display: 'flex', gap: u(S.gap * 2), flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1.55, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap) }}>
              <Headline c={c} t={t} ink={ink} S={S} align="left" sel={sel} showPrice={false} />
              <Details c={c} t={t} ink={ink} S={S} align="left" sel={sel} only={['openHouse', 'description', 'cta']} clamp={c.details.some(d => d.kind === 'highlights') ? 3 : 5} />
              <HighlightsInline c={c} t={t} ink={ink} S={S} align="left" sel={sel} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1), paddingLeft: u(S.gap * 1.4), borderLeft: `${hair} solid ${ink.rule}` }}>
              {c.price && <Pick id={c.price.id} sel={sel}><Price price={c.price} t={t} ink={ink} size={S.price * 0.92} align="left" /></Pick>}
              <Details c={c} t={t} ink={ink} S={S} align="left" sel={sel} only={['facts']} variants={{ facts: 'grid' }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap), flex: 1, minHeight: 0, overflow: 'hidden', alignItems: alignItems(align) }}>
            <Headline c={c} t={t} ink={ink} S={S} align={align} sel={sel} />
            <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['openHouse', 'facts']} variants={{ facts: 'stats', openHouse: tall ? 'hero' : 'line' }} />
            {!tall && <HighlightsInline c={c} t={t} ink={ink} S={S} align={align} sel={sel} />}
            <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['description', 'cta']} clamp={tall ? 3 : 2} />
          </div>
        )}
        <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} />
      </div>
    </>
  )
}

// Highlights as a single centered line - for centered layouts where a bulleted list would read
// ragged and eat the vertical space the footer needs.
function HighlightsInline({ c, t, ink, S, align, sel }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; align: 'left' | 'center'; sel: Sel }) {
  const h = c.details.find(d => d.kind === 'highlights') as Extract<DetailItem, { kind: 'highlights' }> | undefined
  if (!h) return null
  const mark = t.styleId === 'modern_luxury' ? '◆' : '·'
  return (
    <Pick id={h.id} sel={sel}>
      <div style={{ fontFamily: t.fonts.body, fontSize: u(S.body * h.o.k), color: ink.ink, textAlign: align, lineHeight: 1.5, ...h.o.css }}>
        {h.items.map((item, i) => (
          <span key={i}>{i > 0 && <span style={{ color: ink.accent, padding: `0 ${u(S.body * 0.7)}`, fontSize: u(S.body * 0.6) }}>{mark}</span>}{item}</span>
        ))}
      </div>
    </Pick>
  )
}

// The message itself is the hero. Property designs: "Just Sold" / "Open House" / "New Price" set
// huge, with the photo framed in an arch (a crisp offset block for Bold). Lead-gen: the question.
function Statement({ c, t, fam, S: S0, sel }: CompProps) {
  const ink = inkOnBg(t)
  const P = S0.pad
  const align = t.align
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const photo = c.photos[0]
  const hasPhoto = !!photo
  const archRadius = t.styleId === 'bold' ? '0' : t.styleId === 'minimal' ? u(3) : '999px 999px 0 0'
  const openHouse = c.details.find(d => d.kind === 'openHouse') as Extract<DetailItem, { kind: 'openHouse' }> | undefined
  const isPriceStory = c.situation === 'price_improvement' && !!c.price
  const photoShadow = t.styleId === 'bold' ? `${u(1.6)} ${u(1.6)} 0 ${t.accent}` : undefined
  // Narrow vertical formats can't carry the big message, a date, price and facts AND a photo - the
  // date/message wins, price and facts step aside.
  const printWide = c.isPrint && (fam === 'landscape' || fam === 'banner')
  const lean = tall || printWide || (fam === 'story' && !!openHouse)
  const S = printWide ? scaled(S0, c.leadGen ? 0.8 : 0.86) : S0

  const heroText = c.leadGen ? c.title?.text : c.big?.text
  const heroId = c.leadGen ? c.title?.id : c.big?.id
  const heroO = c.leadGen ? c.title?.o : c.big?.o
  const heroChars = c.leadGen ? 14 : 8

  const hero = heroText ? (
    <Pick id={heroId} sel={sel}>
      <Title text={heroText} t={t} ink={ink} size={c.leadGen ? S.big * 0.72 : S.big} align={align} o={heroO} maxChars={heroChars} style={{ lineHeight: t.styleId === 'bold' ? 0.9 : 0.98 }} />
    </Pick>
  ) : null

  const kickerText = c.leadGen ? c.kicker?.text : undefined
  const secondary = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap), alignItems: alignItems(align), width: '100%' }}>
      {kickerText && <Pick id={c.kicker?.id} sel={sel}><Kicker text={kickerText} t={t} ink={ink} size={S.kicker} align={align} /></Pick>}
      {hero}
      {c.leadGen ? (
        <>
          {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.1} align={align} style={printWide || tall ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined} />}
          <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} clamp={3} />
        </>
      ) : (
        <>
          {openHouse && <Pick id={openHouse.id} sel={sel}><OpenHouseLine date={openHouse.date} time={openHouse.time} t={t} ink={ink} size={S.facts * 1.1} align={align} variant="hero" o={openHouse.o} /></Pick>}
          {isPriceStory && <Pick id={c.price!.id} sel={sel}><Price price={c.price!} t={t} ink={ink} size={S.price * 1.25} align={align} showLabel={false} /></Pick>}
          <Rule color={ink.accent} width={u(S.gap * 4)} style={{ alignSelf: align === 'center' ? 'center' : 'flex-start', height: t.styleId === 'bold' ? u(0.9) : hair }} />
          {c.title && (
            <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.4) }}>
              <Title text={c.title.text} t={t} ink={ink} size={S.title * 0.62} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={24} />
              {c.sub && <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 0.95} align={align} />}
            </Pick>
          )}
          {!isPriceStory && !lean && c.price && <Pick id={c.price.id} sel={sel}><Price price={c.price} t={t} ink={ink} size={S.price * 0.8} align={align} /></Pick>}
          {!isPriceStory && lean && c.price && <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}><PriceText c={c} t={t} ink={ink} size={S.facts * 1.25} sel={sel} /></div>}
          {(!lean || (printWide && !openHouse)) && <Details c={c} t={t} ink={ink} S={scaled(S, 0.9)} align={align} sel={sel} only={['facts', 'description', 'highlights', 'cta']} variants={{ facts: 'inline' }} clamp={3} />}
        </>
      )}
    </div>
  )

  if (wide || fam === 'square') {
    const photoW = fam === 'banner' ? 34 : fam === 'square' ? 42 : 40
    const textW = hasPhoto ? `calc(${100 - photoW}% - ${u(P * 2.2)})` : `calc(100% - ${u(P * 2.1)})`
    const photoBottom = fam === 'square' ? '31%' : u(P)
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
        <LuxFrame t={t} ink={ink} inset={P * 0.42} />
        {hasPhoto && <Photo photo={photo} t={t} sel={sel} pickId={c.heroId} radius={archRadius} style={{ position: 'absolute', right: u(P), top: u(P), bottom: photoBottom, width: `calc(${photoW}% - ${u(P)})`, boxShadow: photoShadow }} />}
        {fam === 'square' ? (
          <>
            <div style={{ position: 'absolute', left: u(P * 1.05), top: u(P), bottom: '31%', width: textW, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
              {secondary}
            </div>
            <div style={{ position: 'absolute', left: u(P), right: u(P), bottom: u(P * 0.85), top: '72%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 2 }}>
              <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} qrLabel={false} agentScale={c.leadGen ? 1.1 : 1} />
            </div>
            {c.logo && <div style={{ position: 'absolute', left: u(P * 1.05), top: u(P * 0.7), zIndex: 2 }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.3} /></div>}
          </>
        ) : (
          <div style={{ position: 'absolute', left: u(P * 1.05), top: u(P), bottom: u(P * 0.85), width: textW, display: 'flex', flexDirection: 'column', gap: u(S.gap), zIndex: 2 }}>
            {c.logo && <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.4} /></div>}
            <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'safe center' }}>{secondary}</div>
            <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} narrow={!!c.qr} qrLabel={false} qrScale={0.9} />
          </div>
        )}
      </>
    )
  }

  // Story / portrait / tall - message on top, arched photo, agent at the foot.
  const topPad = fam === 'story' ? 16 : tall ? HANGER_ZONE : P * 1.1
  const photoPct = fam === 'story' ? 26 : tall ? 22 : 36
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: t.bg }} />
      <LuxFrame t={t} ink={ink} inset={P * 0.42} />
      {tall && c.logo && <div style={{ position: 'absolute', top: u(P * 0.8), right: u(P * 0.8), zIndex: 3 }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.2} maxWidth={24} /></div>}
      <div style={{ position: 'absolute', inset: 0, padding: `${u(topPad)} ${u(P * 1.05)} ${u(fam === 'story' ? 14 : P * 0.85)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.3), alignItems: alignItems(align), zIndex: 2 }}>
        {!tall && c.logo && <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start' }}><Logo c={c} t={t} ink={ink} height={S.agentName * 1.4} /></div>}
        {secondary}
        {hasPhoto && <Photo photo={photo} t={t} sel={sel} pickId={c.heroId} radius={archRadius} style={{ width: '100%', flex: '1 1 0', minHeight: `${photoPct}%`, boxShadow: photoShadow }} />}
        <div style={{ marginTop: hasPhoto ? 0 : 'auto', width: '100%' }}>
          <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} qrLabel={fam !== 'story'} agentScale={c.leadGen ? 1.08 : 1} />
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Photo-led compositions (2026-09-30). Each has its own identity - a headline band, a floating
// card, a magazine cover, a photo mosaic, a stamped seal - and the photo always leads. They share
// two tones derived from the theme: `strong` (always dark - the theme's ink on light palettes, its
// background on dark ones) and `light` (the inverse), so every color mode still reads distinctly.
// ---------------------------------------------------------------------------------------------
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

interface Tones { strong: string; light: string; onStrong: Ink; onLight: Ink }
function tones(t: DesignTheme): Tones {
  // Light themes (Ivory, Stone, a light Brand color): the "strong" panel is the theme's own deeper
  // paper tone with dark text - it used to be the near-black text color, so every light theme
  // printed with the same dark bands and the themes looked identical.
  if (!t.isDark) {
    const strong = t.surface
    const light = t.bg
    return {
      strong, light,
      onStrong: { ink: t.ink, muted: t.muted, accent: t.accent, rule: t.rule, fill: t.accent, fillInk: t.accentInk, onPhoto: false, panel: strong },
      onLight: { ink: t.ink, muted: hexA(t.ink, 0.64), accent: t.accent, rule: hexA(t.ink, 0.16), fill: t.accent, fillInk: t.accentInk, onPhoto: false, panel: light },
    }
  }
  const strong = t.isDark ? t.bg : t.ink
  const light = t.isDark ? t.ink : t.bg
  const lightText = light
  const darkText = strong
  const accentOnStrong = t.isDark ? t.accent : t.photoAccent
  const accentOnLight = t.isDark ? '#8A6638' : t.accent
  return {
    strong, light,
    onStrong: { ink: lightText, muted: hexA(lightText, 0.72), accent: accentOnStrong, rule: hexA(lightText, 0.24), fill: accentOnStrong, fillInk: darkText, onPhoto: true, panel: strong },
    onLight: { ink: darkText, muted: hexA(darkText, 0.64), accent: accentOnLight, rule: hexA(darkText, 0.16), fill: accentOnLight, fillInk: lightText, onPhoto: false, panel: light },
  }
}

const findFacts = (c: Content) => c.details.find(d => d.kind === 'facts') as Extract<DetailItem, { kind: 'facts' }> | undefined
const findOpenHouse = (c: Content) => c.details.find(d => d.kind === 'openHouse') as Extract<DetailItem, { kind: 'openHouse' }> | undefined

// "Wayne, PA 19087" -> "Wayne, PA" - the headline place name, zip dropped.
function placeName(c: Content): string {
  const city = (c.sub?.text || '').replace(/\s+\d{5}(-\d{4})?$/, '').trim()
  return city || c.title?.text || ''
}

const SHORT_FACT: Record<string, string> = { Beds: 'BD', Bed: 'BD', Baths: 'BA', Bath: 'BA', 'Sq Ft': 'SF', Acres: 'AC', 'Sq Ft Lot': 'SF LOT', Built: 'BUILT', Type: '' }

// "6 BD   9 BA   10,706 SF" - the compact listing line social posts use.
function FactsLine({ c, t, ink, size, sel, weight = 600, font, nowrap = false }: { c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; weight?: number; font?: string; nowrap?: boolean }) {
  const f = findFacts(c)
  if (!f) return null
  return (
    <Pick id={f.id} sel={sel}>
      <div style={{ display: 'flex', flexWrap: nowrap ? 'nowrap' : 'wrap', columnGap: u(size * 1.1), rowGap: u(size * 0.3), fontFamily: font || t.fonts.label, fontWeight: weight, fontSize: u(size * f.o.k), letterSpacing: '0.04em', color: ink.ink, lineHeight: 1.1, whiteSpace: 'nowrap', ...f.o.css }}>
        {f.items.map(i => <span key={i.key}>{i.value}{SHORT_FACT[i.label] !== '' ? ` ${SHORT_FACT[i.label] ?? i.label.toUpperCase()}` : ''}</span>)}
      </div>
    </Pick>
  )
}

function PriceText({ c, t, ink, size, sel, font, showPrev = true, showLabel = true }: { c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; font?: string; showPrev?: boolean; showLabel?: boolean }) {
  if (!c.price) return null
  return (
    <Pick id={c.price.id} sel={sel}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: u(size * 0.5), flexWrap: 'wrap' }}>
        {showLabel && (c.price.label === 'Sold for' || c.price.label === 'Listed at') && (
          <span style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(size * 0.42), color: ink.muted, whiteSpace: 'nowrap', alignSelf: 'center' }}>{c.price.label}</span>
        )}
        <span style={{ fontFamily: font || t.fonts.price, fontWeight: font ? 600 : t.price.weight, fontSize: u(size * c.price.o.k), letterSpacing: font ? '0.02em' : t.price.tracking, color: ink.ink, lineHeight: 1, whiteSpace: 'nowrap', ...c.price.o.css }}>{c.price.value}</span>
        {showPrev && c.price.previous && <span style={{ fontFamily: t.fonts.label, fontSize: u(size * 0.55), color: ink.muted, textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
      </div>
    </Pick>
  )
}

// A plain, heavy caps label - the band/cover voice (independent of the style's ornamental kicker).
function Label({ text, t, ink, size, color, style, id, sel }: { text: string; t: DesignTheme; ink: Ink; size: number; color?: string; style?: CSSProperties; id?: string; sel: Sel }) {
  return (
    <Pick id={id} sel={sel}>
      <div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(size), lineHeight: 1.2, color: color || ink.ink, whiteSpace: 'nowrap', ...style }}>{text}</div>
    </Pick>
  )
}

// Brokerage mark + agent name - the sign-off corner of band/cover layouts.
function Signature({ c, t, ink, size, align = 'right', sel, photo = false }: { c: Content; t: DesignTheme; ink: Ink; size: number; align?: 'left' | 'right' | 'center'; sel: Sel; photo?: boolean }) {
  const a = c.agent
  if (!a && !c.logo) return null
  const items = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
  return (
    <Pick id={a?.id} sel={sel} style={{ display: 'flex', alignItems: 'center', gap: u(size * 0.8), flexDirection: align === 'right' ? 'row-reverse' : 'row', flexShrink: 1, minWidth: 0, maxWidth: '100%' }}>
      {photo && a && <Headshot agent={a} size={size * 3.4} ring={ink.onPhoto ? 'rgba(255,255,255,0.6)' : ink.accent} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: items, gap: u(size * 0.3), minWidth: 0, maxWidth: '100%', textAlign: align === 'right' ? 'right' : align === 'center' ? 'center' : 'left' }}>
        {/* A long brokerage name ("Berkshire Hathaway HomeServices Fox & Roach") wraps on two lines with tighter tracking; the name steps down rather than running off the edge. */}
        {c.logo ? <Logo c={c} t={t} ink={ink} height={size * 1.5} maxWidth={size * 9} /> : a?.brokerage && (
          <div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: a.brokerage.length > 22 ? '0.1em' : '0.18em', fontSize: u(Math.max(fit(a.brokerage, size, 20, 0.66), fit(a.name || '', size, 20, 0.72))), lineHeight: 1.22, color: ink.ink, whiteSpace: 'normal', maxWidth: '100%' }}>{a.brokerage}</div>
        )}
        {a?.name && <div style={{ fontFamily: t.fonts.label, fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: u(Math.min(fit(a.name, size, 20, 0.72), c.logo || !a.brokerage ? 99 : fit(a.brokerage, size, 20, 0.66))), color: ink.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{a.name}</div>}
        {a?.phone && <Tel kind="mobile" num={a.phone} style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(size * 0.72), color: ink.ink, letterSpacing: '0.04em' }} />}
        {a?.office && <Tel kind="office" num={a.office} style={{ fontFamily: t.fonts.label, fontSize: u(size * 0.68), color: ink.muted, letterSpacing: '0.04em' }} />}
      </div>
    </Pick>
  )
}

// The social sign-off: one full-width row - who (headshot, name, title/brokerage), how to reach
// them (phone, email), and the brand mark - instead of a stack crammed into a corner.
function AgentBar({ button = true, ...p }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; fam: DesignFamily; compact?: boolean; button?: boolean }) {
  const row = <AgentRow {...p} />
  const label = button && !p.c.isPrint ? p.c.socialButton : null
  if (!label) return row
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(p.S.gap * 0.7), width: '100%', minWidth: 0 }}>
      <SocialButton c={p.c} t={p.t} ink={p.ink} S={p.S} sel={p.sel} fam={p.fam} label={label} style={{ alignSelf: 'flex-end' }} />
      {row}
    </div>
  )
}

function SocialButton({ c, t, ink, S, sel, fam, label, style }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; fam: DesignFamily; label: string; style?: CSSProperties }) {
  const k = fam === 'story' ? 0.85 : 1
  return (
    <Pick id={c.title?.id} sel={sel} style={style}>
      <div style={{ background: ink.fill, color: ink.fillInk, display: 'flex', alignItems: 'center', gap: u(S.facts * 0.5 * k), padding: `${u(S.facts * 0.6 * k)} ${u(S.facts * 1.2 * k)}`, borderRadius: u(S.facts * 0.25), boxShadow: '0 0.5cqmin 1.2cqmin rgba(0,0,0,0.16)' }}>
        <span style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.1, letterSpacing: '0.14em', fontSize: u(S.facts * 0.95 * k) }}>{label}</span>
        <svg viewBox="0 0 12 12" fill="none" stroke={ink.fillInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(S.facts * 0.75 * k), height: u(S.facts * 0.75 * k) }}><path d="M4 2 L8.5 6 L4 10" /></svg>
      </div>
    </Pick>
  )
}

function AgentRow({ c, t, ink, S, sel, fam, compact = false }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; fam: DesignFamily; compact?: boolean }) {
  const a = c.agent
  if (!a && !c.logo) return null
  const wide = fam === 'landscape' || fam === 'banner'
  const k = wide ? 0.82 : fam === 'story' ? 0.7 : fam === 'portrait' || fam === 'tall' ? 0.9 : 1
  const nameFont = t.styleId === 'modern_luxury' || t.styleId === 'editorial' ? t.fonts.display : t.fonts.body
  // The brokerage gets its own bold line, never smaller than the name (user + advertising rules,
  // 10/09); the title is the quiet line.
  const brokerage = a?.brokerage || ''
  const role = brokerage ? '' : a?.title || '' // the brokerage line takes the title's place (keeps the row's height)
  const phone = a?.phone || ''
  const email = compact ? '' : a?.email || ''
  // Long names/emails step down to fit instead of being cut off.
  const nameRoom = (t.styleId === 'modern_luxury' ? 15 : 18) - (c.logo ? 3 : 0) - (email ? 1 : 0)
  const brokerBase = S.agentName * 1.42 * k * 0.95
  const brokerSize = brokerage ? fit(brokerage, brokerBase, nameRoom + 6, 0.6) : 99
  const nameSize = Math.min(fit(a?.name || '', S.agentName * 1.42 * k, nameRoom, 0.68), brokerSize)
  const brokerLine = (size: number) => brokerage && (
    <div style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(Math.max(size, 0)), lineHeight: 1.15, color: ink.ink, marginTop: u(S.agentMeta * 0.3), whiteSpace: brokerage.length > nameRoom + 8 ? 'normal' : 'nowrap', textWrap: 'balance' as any }}>{brokerage}</div>
  )
  const emailSize = fit(email, S.agentMeta * 1.34 * k, c.logo ? 22 : 26, 0.72)
  if (compact) {
    const cBroker = brokerage ? fit(brokerage, S.agentName * 1.3 * k * 0.95, (t.styleId === 'modern_luxury' ? 12 : 15) + 6, 0.6) : 99
    const cName = Math.min(fit(a?.name || '', S.agentName * 1.3 * k, t.styleId === 'modern_luxury' ? 12 : 15, 0.6), cBroker)
    return (
      <Pick id={a?.id} sel={sel} className="ohp-foot" style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.9 * k), width: '100%', minWidth: 0 }}>
        {a && <Headshot agent={a} size={S.headshot * 1.05 * k} ring={ink.onPhoto ? 'rgba(255,255,255,0.6)' : ink.accent} />}
        <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: u(S.agentMeta * 0.32) }}>
          {a?.name && (
            <div style={{
              fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'none', letterSpacing: '0',
              fontSize: u(cName), lineHeight: 1.08, color: ink.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{a.name}</div>
          )}
          {brokerage && brokerLine(cName)}
          {phone && <Tel kind="mobile" num={phone} style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(S.agentMeta * 1.4 * k), color: ink.ink, letterSpacing: '0.02em', fontVariantNumeric: 'lining-nums' }} />}
        </div>
        {c.logo && <Logo c={c} t={t} ink={ink} height={S.agentName * 1.4 * k} maxWidth={S.agentName * 6} />}
      </Pick>
    )
  }
  return (
    <Pick id={a?.id} sel={sel} className="ohp-foot" style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.1 * k), width: '100%', minWidth: 0 }}>
      {a && <Headshot agent={a} size={S.headshot * 1.15 * k} ring={ink.onPhoto ? 'rgba(255,255,255,0.6)' : ink.accent} />}
      {/* The name is never cut off: when the row is tight it wraps to a second line instead; the
          contact column keeps its phone whole and shortens the email. */}
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        {a?.name && (
          <div style={{
            fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'none', letterSpacing: '0',
            fontSize: u(nameSize), lineHeight: 1.08, color: ink.ink, whiteSpace: 'normal', textWrap: 'balance' as any,
          }}>{a.name}</div>
        )}
        {brokerLine(nameSize)}
        {role && <div style={{ fontFamily: t.fonts.label, fontWeight: 500, fontSize: u(S.agentMeta * 1.2 * k), lineHeight: 1.3, color: ink.muted, marginTop: u(S.agentMeta * 0.25), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{role}</div>}
      </div>
      {(phone || email || (a?.website && !compact)) && (
        <div style={{ flex: '0 0 auto', minWidth: 0, maxWidth: c.logo ? '38%' : '46%', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: u(S.agentMeta * 0.35) }}>
          {phone && <Tel kind="mobile" num={phone} style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(S.agentMeta * 1.6 * k), color: ink.ink, letterSpacing: '0.02em', fontVariantNumeric: 'lining-nums' }} />}
          {email && <div style={{ fontFamily: t.fonts.label, fontWeight: 500, fontSize: u(emailSize), color: ink.ink, opacity: 0.86, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{email}</div>}
          {a?.website && !compact && <div style={{ fontFamily: t.fonts.label, fontWeight: 500, fontSize: u(emailSize), color: ink.ink, opacity: 0.86, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{a.website}</div>}
        </div>
      )}
      {c.logo && (
        <>
          <Rule color={ink.rule} vertical />
          <Logo c={c} t={t} ink={ink} height={S.agentName * 1.6 * k} maxWidth={S.agentName * 7.5} />
        </>
      )}
    </Pick>
  )
}

// A photo "stage" with the AgentBar across the whole bottom on a solid band. Children are laid
// out absolutely inside the stage (which excludes the bar). Stories keep the bar's content above
// Instagram's reply bar.
function StageWithBar({ c, t, fam, S, sel, children, tone = 'light' }: { c: Content; t: DesignTheme; fam: DesignFamily; S: Sizes; sel: Sel; children: ReactNode; tone?: 'light' | 'strong' }) {
  const T = tones(t)
  const ink = tone === 'light' ? T.onLight : T.onStrong
  const P = S.pad
  const hasBar = !!(c.agent || c.logo)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{children}</div>
      {hasBar && (
        <div style={{ position: 'relative', zIndex: 2, background: tone === 'light' ? T.light : T.strong, padding: `${u(P * 0.55)} ${u(P)} ${u(fam === 'story' ? 11 : P * 0.55)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
          <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
          {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
        </div>
      )}
    </div>
  )
}

// ── Headline Band: a solid band carrying the news + the place, the photo edge to edge, a clean
// facts band, a thin closing strip. Social's most-used luxury format.
function Band({ c, t, fam, S, sel, ar = 1 }: CompProps) {
  const T = tones(t)
  const P = S.pad
  const place = placeName(c)
  const oh = findOpenHouse(c)
  const kick = c.kicker?.text || ''
  const titleFont: CSSProperties = { fontFamily: t.styleId === 'minimal' ? t.fonts.label : t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : t.styleId === 'minimal' ? 600 : t.display.weight, textTransform: 'uppercase', letterSpacing: t.styleId === 'bold' ? '0.01em' : t.styleId === 'modern_luxury' ? '0.05em' : '0.01em', lineHeight: 1.02, whiteSpace: 'nowrap' }
  // `room` = the width the place name may use, in cqmin; caps run ~0.66em per character (wide-set serif caps more).
  const charW = t.styleId === 'bold' ? 0.5 : t.styleId === 'modern_luxury' ? 0.76 : 0.68
  const canvasW = 100 * Math.max(ar, 1)
  const ohText = oh ? [oh.date, oh.time].filter(Boolean).join('  ·  ') : ''
  const street = c.title?.isAddress && place !== c.title.text ? c.title.text : ''
  // The street address leads, set large; the town rides small in the top-right corner. With the
  // street hidden (privacy), the town takes the big line instead.
  const bigText = street || place
  const smallTown = street ? place : ''
  const placeFs = (base: number, room: number) => Math.min(base, room / Math.max(bigText.length, 4) / charW)
  // A long street line wraps to two balanced lines instead of shrinking to a whisper.
  const bigLines = (base: number, room: number): { fs: number; wrap: boolean } => {
    const one = placeFs(base, room)
    if (one >= base * 0.62) return { fs: one, wrap: false }
    return { fs: Math.min(base * 0.88, Math.max(base * 0.5, (room * 1.9) / Math.max(bigText.length, 4) / charW)), wrap: true }
  }
  const longTitle = !c.leadGen && bigText.length > 24
  const longDate = ohText.length > 30

  // Lead-gen: the band carries the eyebrow + the question itself (it may wrap to two lines).
  const lead = c.leadGen
  // `narrow`: a side panel (wide formats) - the street drops under the place, the date may wrap.
  const head = (size: number, room: number, ink: Ink, center = false, narrow = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.55), alignItems: center ? 'center' : 'stretch', minWidth: 0, width: '100%' }}>
      {(kick || (smallTown && !narrow)) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: u(S.gap) }}>
          {kick && <Label text={kick} t={t} ink={ink} size={S.kicker * (lead ? 0.9 : 1.08)} id={c.kicker?.id} sel={sel} color={ink.accent} style={{ whiteSpace: lead ? 'normal' : 'nowrap', letterSpacing: lead ? '0.14em' : '0.24em' }} />}
          {smallTown && !narrow && <div style={{ marginLeft: 'auto', fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.kicker * 0.78), color: ink.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{smallTown}</div>}
        </div>
      )}
      {lead ? (
        c.title && <Pick id={c.title.id} sel={sel}><div style={{ ...titleFont, whiteSpace: 'normal', textWrap: 'balance' as any, fontSize: u(Math.min(size * (narrow ? 0.9 : 0.82), (room * (narrow ? 3.4 : 2)) / Math.max(c.title.text.length, 8) / charW)), color: ink.ink, lineHeight: 1.06 }}>{c.title.text}</div></Pick>
      ) : bigText && (() => { const b = bigLines(size, room); return <Pick id={c.title?.id} sel={sel}><div style={{ ...titleFont, whiteSpace: b.wrap ? 'normal' : 'nowrap', textWrap: 'balance' as any, fontSize: u(b.fs), color: ink.ink }}>{bigText}</div></Pick> })()}
      {narrow && smallTown && <div style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.kicker * 0.78), color: ink.muted }}>{smallTown}</div>}
      {oh && ohText && <Pick id={oh.id} sel={sel}><div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: u(S.facts * (narrow ? 0.8 : 0.95)), color: ink.accent, whiteSpace: narrow || longDate ? 'normal' : 'nowrap', lineHeight: 1.35 }}>{narrow || longDate ? <>{oh.date}{oh.date && oh.time && <br />}{oh.time}</> : ohText}</div></Pick>}
    </div>
  )
  const factsBand = (size: number, ink: Ink, wrap = false, ctaOnly = false) => lead ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(size * 0.5), minWidth: 0 }}>
      {!ctaOnly && c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={size * 0.84} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
      <Details c={c} t={t} ink={ink} S={scaled(S, size / S.facts * 0.8)} align="left" sel={sel} only={['cta']} />
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: wrap ? 'flex-start' : 'center', flexDirection: wrap ? 'column' : 'row', gap: u(size * (wrap ? 0.5 : 1.2)), minWidth: 0, flexWrap: 'nowrap' }}>
      <FactsLine c={c} t={t} ink={ink} size={size} sel={sel} weight={500} nowrap />
      <PriceText c={c} t={t} ink={ink} size={size} sel={sel} font={t.fonts.label} />
    </div>
  )

  if (fam === 'square' || fam === 'landscape' || fam === 'banner' || (fam === 'portrait' && !c.isPrint)) {
    const wide = fam === 'landscape' || fam === 'banner'
    if (fam === 'banner') {
      return (
        <>
          <div style={{ position: 'absolute', inset: 0, background: T.light }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '31%', background: T.strong, padding: u(P), display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{head(S.title * 0.72, canvasW * 0.31 - P * 2, T.onStrong, false, true)}</div>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: '31%', top: 0, bottom: 0, width: '38%' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '31%', padding: u(P * 0.9), display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * 1.2) }}>
            {factsBand(S.facts * 0.95, T.onLight, true)}
            <Signature c={c} t={t} ink={T.onLight} size={S.agentMeta * 1.1} align="left" sel={sel} />
          </div>
        </>
      )
    }
    const social = !c.isPrint && !!(c.agent || c.logo)
    const stats = !c.isPrint && !lead
    const topH = wide ? 0 : (lead ? 30 : oh ? 24 : 20) + (longTitle ? 4 : 0) + (longDate && oh ? 3 : 0)
    // Lead-gen keeps its supporting line + button in the light band, so that band is taller; listing
    // posts carry the price as the hero beside the stats there.
    const bottomH = c.isPrint ? 24 : lead ? (wide ? 24 : 21) : wide ? 18 : 14.5
    const strip = c.isPrint ? 7 : social ? (wide ? 19 : 15.5) : wide ? 2.2 : 3.2
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: T.strong }} />
        {wide ? (
          <>
            <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', right: 0, top: 0, width: '64%', bottom: `${bottomH + strip}%` }} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: '36%', bottom: `${bottomH + strip}%`, padding: u(P), display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {head(S.title * 0.8, canvasW * 0.36 - P * 2, T.onStrong, false, true)}
            </div>
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${topH}%`, padding: `0 ${u(P)}`, display: 'flex', alignItems: 'center' }}>{head(S.title * 1.15, canvasW - P * 2, T.onStrong)}</div>
            <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: 0, right: 0, top: `${topH}%`, bottom: `${bottomH + strip}%` }} />
          </>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${strip}%`, height: `${bottomH}%`, background: T.light, padding: `0 ${u(P)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(S.gap * 1.5) }}>
          {stats ? <PriceStats c={c} t={t} ink={T.onLight} S={S} sel={sel} label={false} k={wide ? 0.88 : 1.02} /> : factsBand(S.facts * (wide ? 1 : 1.3), T.onLight)}
          {!social && (
            <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.2), flexShrink: 0 }}>
              <Signature c={c} t={t} ink={T.onLight} size={S.agentName * (wide ? 0.85 : 0.98)} sel={sel} />
              {c.isPrint && <Qr c={c} t={t} ink={T.onLight} size={S.qr * 0.72} sel={sel} labelSide="none" />}
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${strip}%`, background: social ? T.strong : t.styleId === 'bold' ? T.onStrong.accent : T.strong, display: 'flex', alignItems: 'center', padding: `0 ${u(P)}`, borderTop: social && t.styleId === 'bold' ? `${u(0.9)} solid ${T.onStrong.accent}` : undefined }}>
          {social && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: u(0.5), background: T.onStrong.accent }} />}
          {social ? <AgentBar c={c} t={t} ink={T.onStrong} S={S} sel={sel} fam={fam} /> : c.isPrint && <FinePrint c={c} ink={T.onStrong} t={t} size={S.fine * 0.8} />}
        </div>
      </>
    )
  }

  if (fam === 'story') {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: T.strong }} />
        {(() => {
          // Stories: the band grows for a long street line or a two-day open house; lead-gen keeps
          // the question in the band and just the button in the light strip (the supporting line
          // would collide with the agent bar above Instagram's reply bar).
          const headH = (lead ? 19 : 15) + (longTitle ? 4 : 0) + (longDate && oh ? 3 : 0)
          return (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '12%', height: `${headH}%`, padding: `0 ${u(P)}`, display: 'flex', alignItems: 'center' }}>{head(S.title * 1.1, canvasW - P * 2, T.onStrong)}</div>
              <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: 0, right: 0, top: `${13 + headH}%`, bottom: lead ? '31%' : '34%' }} />
            </>
          )
        })()}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '22%', height: lead ? '9%' : '12%', background: T.light, padding: `0 ${u(P)}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * 0.9) }}>
          {lead ? factsBand(S.facts * 1.05, T.onLight, false, true) : <PriceStats c={c} t={t} ink={T.onLight} S={S} sel={sel} label={false} k={0.86} />}
        </div>
        {(c.agent || c.logo) && (
          <div style={{ position: 'absolute', left: u(P), right: u(P), bottom: '11%', height: '10.5%', display: 'flex', alignItems: 'center' }}>
            <AgentBar c={c} t={t} ink={T.onStrong} S={S} sel={sel} fam={fam} />
          </div>
        )}
      </>
    )
  }

  // Print: flyer (portrait) and door hanger (tall) - band, photo, supporting strip, the details.
  const tall = fam === 'tall'
  const strip = c.photos.slice(1, tall ? 3 : 4)
  const ink = T.onLight
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: T.light }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: T.strong, padding: `${u(tall ? HANGER_ZONE : P * 0.9)} ${u(P)} ${u(P * 0.8)}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(S.gap), flexShrink: 0 }}>
          {head(S.title * (tall ? 0.95 : 1.05), (tall ? 100 : canvasW) - P * 2 - (!tall && c.logo ? 25 : 0), T.onStrong, false, tall)}
          {!tall && c.logo && <Logo c={c} t={t} ink={T.onStrong} height={S.agentName * 1.8} />}
        </div>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ flex: tall ? (lead ? '0 0 36%' : '0 0 30%') : lead ? '0 0 52%' : '0 0 44%' }} />
        {strip.length > 0 && (
          <Pick id={c.galleryId} sel={sel} style={{ flex: tall ? '0 0 9%' : '0 0 12%', display: 'flex', gap: u(0.6), paddingTop: u(0.6), background: T.light }}>
            {strip.map((p, i) => <Photo key={i} photo={p} t={t} sel={{}} style={{ flex: 1 }} />)}
          </Pick>
        )}
        <div style={{ flex: 1, minHeight: 0, padding: `${u(P * 0.75)} ${u(P)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap) }}>
          {factsBand(S.facts * (tall ? 1.15 : 1.25), ink, tall)}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: u(S.gap) }}>
            <Details c={c} t={t} ink={ink} S={S} align="left" sel={sel} only={lead ? ['description', 'highlights'] : tall ? ['highlights', 'cta'] : ['description', 'highlights', 'cta']} clamp={tall ? 2 : 4} />
          </div>
          <Footer c={c} t={t} ink={ink} S={S} sel={sel} align="left" fam={fam} />
        </div>
        <div style={{ height: u(1.6), background: T.strong, flexShrink: 0 }} />
      </div>
    </>
  )
}

// ── Floating Card: the photo fills the frame; a crisp card floats over it with everything to know.
function Card({ c, t, fam, S, sel }: CompProps) {
  const T = tones(t)
  const P = S.pad
  const ink = T.onLight
  const align = t.align
  const oh = findOpenHouse(c)
  if (fam === 'tall' || fam === 'banner') return <Cinematic c={c} t={t} fam={fam} S={S} sel={sel} />
  const shadow = `0 ${u(1.2)} ${u(5)} rgba(0,0,0,0.28)`
  const cardInner = (k: number, withAgent: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8 * k), alignItems: alignItems(align) }}>
      {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * k} align={align} variant="line" o={oh.o} /></Pick>}
      {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker * k} align={align} o={c.kicker.o} /></Pick>}
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.35) }}>
          <Title text={c.title.text} t={t} ink={ink} size={S.title * 0.82 * k} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={c.leadGen ? 26 : 18} />
          {c.sub && (c.title.isAddress ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * k} align={align} /> : <Lede text={c.sub.text} t={t} ink={ink} size={S.body * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />)}
        </Pick>
      )}
      {(c.price || findFacts(c)) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: u(S.gap * 1.2 * k), flexWrap: 'wrap', paddingTop: u(S.gap * 0.3) }}>
          <PriceText c={c} t={t} ink={ink} size={S.price * 0.62 * k} sel={sel} />
          <FactsLine c={c} t={t} ink={ink} size={S.facts * 0.95 * k} sel={sel} />
        </div>
      )}
      <Details c={c} t={t} ink={ink} S={scaled(S, k)} align={align} sel={sel} only={['cta']} />
      {withAgent && (c.agent || c.logo) && (
        <>
          <Rule color={ink.rule} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(S.gap), width: '100%' }}>
            <AgentCard c={c} t={t} ink={ink} S={S} sel={sel} scale={0.82 * k} narrow />
            <Logo c={c} t={t} ink={ink} height={S.agentName * 1.25 * k} />
          </div>
        </>
      )}
    </div>
  )

  if (fam === 'portrait') {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: T.light }} />
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '64%' }} />
        <div style={{ position: 'absolute', left: u(P), right: u(P), top: '46%', background: T.light, padding: u(P * 0.8), boxShadow: shadow, zIndex: 2 }}>
          {cardInner(1, false)}
          <div style={{ marginTop: u(S.gap), overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['description']} clamp={3} /></div>
        </div>
        <div style={{ position: 'absolute', left: u(P), right: u(P), bottom: u(P * 0.7), zIndex: 2 }}>
          <Footer c={c} t={t} ink={ink} S={S} sel={sel} align="left" fam={fam} />
        </div>
      </>
    )
  }

  const story = fam === 'story'
  const land = fam === 'landscape'
  const cardStyle: CSSProperties = story
    ? { left: u(P * 0.8), right: u(P * 0.8), bottom: u(P * 0.8) }
    : land
      ? { right: u(P * 0.8), top: u(P * 0.7), bottom: u(P * 0.7), width: '42%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }
      : { left: u(P * 0.7), bottom: u(P * 0.7), width: '70%' }
  return (
    <StageWithBar c={c} t={t} fam={fam} S={S} sel={sel}>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, rgba(${t.scrim},0.35) 0%, rgba(${t.scrim},0) 45%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', ...cardStyle, background: T.light, padding: u(P * (land ? 0.75 : 0.7)), boxShadow: shadow, zIndex: 2 }}>
        {t.frame && <div style={{ position: 'absolute', inset: u(P * 0.25), border: `${hair} solid ${ink.accent}`, opacity: 0.55, pointerEvents: 'none' }} />}
        {cardInner(land ? 0.95 : story ? 1.05 : 0.98, false)}
      </div>
    </StageWithBar>
  )
}

// ── Luxe (IDX): the OpenHousePal signature. The photo sits framed in a fine double gold line with
// diamond corners; it melts into a midnight plate that carries the story - a diamond-flanked gold
// kicker, the address set large, the town, the facts strung on gold diamonds, a gold price, and
// the agent's sign-off under a gold hairline. The palette's own deep tone tints the midnight and its
// luminous accent is the gold, so every color theme gives its own Luxe.
function LuxeDiamond({ size, color }: { size: number; color: string }) {
  return <span style={{ display: 'inline-block', width: u(size), height: u(size), background: color, transform: 'rotate(45deg)', flexShrink: 0 }} />
}

function LuxeKicker({ text, t, gold, size, id, sel }: { text: string; t: DesignTheme; gold: string; size: number; id?: string; sel: Sel }) {
  const fs = fit(text, size, 16, 0.5)
  return (
    <Pick id={id} sel={sel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(fs * 0.85) }}>
        {text.length <= 18 && <span style={{ display: 'block', height: hair, width: u(fs * 3.6), background: `linear-gradient(90deg, transparent, ${gold})` }} />}
        <LuxeDiamond size={fs * 0.42} color={gold} />
        <span style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.38em', paddingLeft: '0.38em', fontSize: u(fs), lineHeight: 1.2, color: gold, whiteSpace: 'nowrap' }}>{text}</span>
        <LuxeDiamond size={fs * 0.42} color={gold} />
        {text.length <= 18 && <span style={{ display: 'block', height: hair, width: u(fs * 3.6), background: `linear-gradient(270deg, transparent, ${gold})` }} />}
      </div>
    </Pick>
  )
}

function LuxeFacts({ c, t, gold, size, sel }: { c: Content; t: DesignTheme; gold: string; size: number; sel: Sel }) {
  const f = findFacts(c)
  if (!f) return null
  return (
    <Pick id={f.id} sel={sel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(size * 0.85), fontFamily: t.fonts.label, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: u(size * f.o.k), lineHeight: 1.1, color: t.isDark ? 'rgba(255,255,255,0.9)' : hexA(t.ink, 0.85), whiteSpace: 'nowrap', ...f.o.css }}>
        {f.items.map((i, k) => (
          <span key={i.key} style={{ display: 'inline-flex', alignItems: 'center', gap: u(size * 0.85) }}>
            {k > 0 && <LuxeDiamond size={size * 0.34} color={gold} />}
            <span>{i.value}{SHORT_FACT[i.label] !== '' ? ` ${SHORT_FACT[i.label] ?? i.label.toUpperCase()}` : ''}</span>
          </span>
        ))}
      </div>
    </Pick>
  )
}

function LuxeGoldFrame({ inset, gold }: { inset: number; gold: string }) {
  const corner = (pos: CSSProperties) => <span style={{ position: 'absolute', width: u(1.7), height: u(1.7), background: gold, transform: 'rotate(45deg)', ...pos }} />
  return (
    <div style={{ position: 'absolute', inset: u(inset), pointerEvents: 'none', zIndex: 4 }}>
      <div style={{ position: 'absolute', inset: 0, border: `${hair} solid ${hexA(gold, 0.75)}` }} />
      <div style={{ position: 'absolute', inset: u(1.05), border: `${hair} solid ${hexA(gold, 0.3)}` }} />
      {corner({ left: u(-0.85), top: u(-0.85) })}
      {corner({ right: u(-0.85), top: u(-0.85) })}
      {corner({ left: u(-0.85), bottom: u(-0.85) })}
      {corner({ right: u(-0.85), bottom: u(-0.85) })}
    </div>
  )
}

function Luxe({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  const wide = fam === 'landscape' || fam === 'banner'
  const S = fam === 'banner' ? scaled(S0, 0.78) : wide ? scaled(S0, 0.9) : S0
  const P = S.pad
  // Light themes print Luxe on paper - the deeper antique gold reads there, the pale one doesn't.
  const gold = !t.isDark ? t.accent : /^#/.test(t.photoAccent) ? t.photoAccent : '#E2C58F'
  const night = (a: number) => `rgba(${t.scrim},${a})`
  const ink: Ink = { ...inkOnPhoto(t), accent: gold, fill: gold, rule: hexA(gold, 0.4) }
  const oh = findOpenHouse(c)
  const facts = findFacts(c)
  const story = fam === 'story'
  const tall = fam === 'tall'
  const print = c.isPrint
  const kick = c.kicker?.text || ''

  const brand = c.logo
    ? <Logo c={c} t={t} ink={ink} height={S.agentName * 1.45} maxWidth={S.agentName * 9} />
    : c.agent?.brokerage
      ? <div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: c.agent.brokerage.length > 24 ? '0.14em' : '0.28em', paddingLeft: c.agent.brokerage.length > 24 ? '0.14em' : '0.28em', fontSize: u(fit(c.agent.brokerage, S.kicker * 1.05, 22, 0.55)), color: hexA(ink.ink, 0.88), whiteSpace: c.agent.brokerage.length > 30 ? 'normal' : 'nowrap', textAlign: 'center', maxWidth: '88%', lineHeight: 1.4, textShadow: t.isDark ? '0 1px 8px rgba(0,0,0,.45)' : undefined }}>{c.agent.brokerage}</div>
      : null

  const price = c.price && (
    <Pick id={c.price.id} sel={sel}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.2) }}>
        {c.price.label && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.24em', fontSize: u(S.facts * 0.56), color: hexA(ink.ink, 0.62), whiteSpace: 'nowrap' }}>{c.price.label}</span>}
        <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(S.price * 0.86 * t.price.scale * c.price.o.k), lineHeight: 1, color: gold, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
        {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontSize: u(S.facts * 0.58), color: hexA(ink.ink, 0.55), textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
      </div>
    </Pick>
  )

  // The midnight plate's story, centered. `k` scales it for the narrower wide-format panel.
  const plate = (k: number, room: 'full' | 'panel') => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.gap * 0.62 * k), width: '100%', minWidth: 0 }}>
      {kick && <LuxeKicker text={kick} t={t} gold={gold} size={S.kicker * 0.95 * k} id={c.kicker?.id} sel={sel} />}
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.32 * k), width: '100%' }}>
          <Title text={c.title.text} t={t} ink={ink} size={S.title * (c.leadGen ? 0.78 : 0.9) * k} align="center" o={c.title.o} placeholder={c.title.placeholder} maxChars={c.leadGen ? 24 : room === 'panel' ? 20 : 18} />
          {c.sub && (c.title.isAddress
            ? <div style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3em', paddingLeft: '0.3em', fontSize: u(S.sub * 0.78 * k), color: hexA(ink.ink, 0.72), whiteSpace: 'nowrap' }}>{c.sub.text}</div>
            : <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 0.95 * k} align="center" style={{ display: '-webkit-box', WebkitLineClamp: tall ? 5 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '92%' }} />)}
        </Pick>
      )}
      {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 0.95 * k} align="center" o={oh.o} /></Pick>}
      {(price || facts) && (
        room === 'panel' || story || tall
          ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.55 * k) }}>{facts && <LuxeFacts c={c} t={t} gold={gold} size={S.facts * 0.82 * k} sel={sel} />}{price}</div>
          : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(S.gap * 1.3 * k), maxWidth: '100%' }}>
              {facts && <LuxeFacts c={c} t={t} gold={gold} size={S.facts * 0.8 * k} sel={sel} />}
              {facts && price && <span style={{ display: 'block', width: hair, alignSelf: 'stretch', background: hexA(gold, 0.45) }} />}
              {price}
            </div>
          )
      )}
      <Details c={c} t={t} ink={ink} S={scaled(S, 0.92 * k)} align="center" sel={sel} only={['cta']} />
    </div>
  )

  const signOff = (k: number) => (c.agent || c.logo) && (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.55 * k) }}>
      <span style={{ display: 'block', height: hair, width: '62%', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
      {print
        ? <Footer c={c} t={t} ink={ink} S={scaled(S, 0.92 * k)} sel={sel} align="left" fam={fam} rule={false} narrow={wide} qrLabel={!wide} />
        : <AgentBar c={c} t={t} ink={ink} S={scaled(S, 0.92 * k)} sel={sel} fam={fam} />}
      {c.leadGen && !print && <FinePrint c={c} ink={ink} t={t} size={S.fine} align="center" />}
    </div>
  )

  const photoLayer = (melt: string) => (
    <>
      {c.photos[0]
        ? <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
        : <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 70% at 70% 20%, ${hexA(gold, 0.32)}, transparent 60%), linear-gradient(135deg, ${night(1)}, ${night(0.85)})` }} />}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: melt }} />
    </>
  )

  // Postcards (user 10/12 rebuild): the approved postcard order - the photo framed on the left with its
  // address plate and a little gold calendar on its corner; the status set big in serif, the price and the
  // QR on the right; the agent along the bottom - all the Luxe way: midnight, gold keylines, serif type.
  // Letter-size pages (letter, flyers) use the same pieces stacked: the status, the framed photo with its
  // plate, then the price beside a tall QR card, then the agent bar.
  // Square posts (user 10/13) use the same pieces: the status across the top, then the framed photo beside the
  // price and a stats grid (or the promises and the ask), then the agent bar - no QR on social.
  // 4:5 posts (user 10/13) take the approved letter layout - the ask box stands in for the QR card
  if (((fam === 'landscape' || fam === 'portrait') && print) || ((fam === 'square' || fam === 'portrait' || fam === 'story') && !print)) {
    const port = fam === 'portrait'
    // stories (user 10/13): the square design stacked, kept clear of the Instagram header and reply bar
    const st = fam === 'story' && !print
    const sq = fam === 'square' || st
    const AW = port || sq ? 100 : 100 * Math.max(1.2, ar)
    const AH = port ? 100 / Math.min(0.95, ar || 0.77) : 100
    const padT = port ? 8.4 : st ? 10 : sq ? 6.6 : 7.4, padX = sq ? 7.2 : 8.6, padB = port ? 5.6 : st ? 9 : sq ? 4.8 : 5.2
    const inner = AW - padX * 2
    const LW = port || st || (sq && !c.leadGen) ? inner : inner * (sq ? 0.56 : 0.53), gapC = sq ? 4.4 : 5.4, RW = port || st ? inner : inner - LW - gapC
    // portrait bottom row: the price (or promises) on the left, the QR card on the right
    const PW = port ? inner * 0.58 : RW, QW = port ? inner - inner * 0.58 - 5 : RW
    const ivory = ink.ink
    const capsL: CSSProperties = { fontFamily: t.fonts.label, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.15 }
    const cardBg = hexA(ivory, t.isDark ? 0.045 : 0.035)
    const ornament = (w: number) => (
      <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(1.2), width: u(w) }}>
        <span style={{ flex: 1, height: hair, background: `linear-gradient(90deg, transparent, ${hexA(gold, 0.8)})` }} />
        <LuxeDiamond size={1.3} color={gold} />
        <span style={{ flex: 1, height: hair, background: `linear-gradient(270deg, transparent, ${hexA(gold, 0.8)})` }} />
      </div>
    )
    const kickLine = (text: string, size: number, id?: string) => {
      const ls = 0.3
      const fs = Math.min(size, (RW - 12) / (Math.max(4, text.length) * (0.66 + ls)))
      return (
        <Pick id={id} sel={sel} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(fs * 0.7), width: '100%' }}>
            <span style={{ flex: '1 1 0', maxWidth: u(10), height: hair, background: `linear-gradient(90deg, transparent, ${gold})` }} />
            <LuxeDiamond size={fs * 0.42} color={gold} />
            <span style={{ ...capsL, fontWeight: 600, letterSpacing: `${ls}em`, paddingLeft: `${ls}em`, fontSize: u(fs), color: gold }}>{text}</span>
            <LuxeDiamond size={fs * 0.42} color={gold} />
            <span style={{ flex: '1 1 0', maxWidth: u(10), height: hair, background: `linear-gradient(270deg, transparent, ${gold})` }} />
          </div>
        </Pick>
      )
    }
    // address plate hanging off the photo's bottom edge - it may run wider than the photo
    const addr = c.title?.isAddress ? c.title : null
    const aLines = addr ? (addr.text.length > 22 ? splitLines(addr.text, 2) : [addr.text]) : []
    const aFs = addr ? Math.min(st ? 5.8 : 4.5, (LW * (st ? 0.88 : 0.72)) / (Math.max(...aLines.map(l => l.length)) * 0.6)) : 0
    const sFs = c.sub ? Math.min(st ? 2.5 : 2, (LW * (st ? 0.76 : 0.66)) / (c.sub.text.length * 0.98)) : 0
    const plateH = addr ? aFs * 1.1 * aLines.length + (c.sub ? sFs * 1.4 + 0.9 : 0) + 3.8 : 0
    const kPlate = c.leadGen && !!kick
    const kFs = kPlate ? Math.min(4.2, (LW * 0.78) / (kick.length * 0.78)) : 0
    const kPlateH = kPlate ? kFs * 1.15 + 4 : 0
    // open house: the same little gold calendars as the door hanger, clipped to the photo's top corner
    const days = oh ? (() => {
      const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
      const ds = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
      const ts = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
      return ds.map((d, k) => {
        const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
        const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
        return { wd, mon: m ? m[1] : '', day: m ? m[2] : rest, time: ts.length > 1 ? ts[k] ?? '' : ts[0] ?? '' }
      })
    })() : []
    const tileW = sq ? 20 : days.length > 1 ? 22 : 23
    // a long time range sits on two lines (start / end) so it can stay big
    const tLines = (x: string) => x.length > 11 && x.includes('–') ? [x.split('–')[0].trim() + ' –', x.split('–').slice(1).join('–').trim()] : [x]
    const tFs = Math.min(2.4, (tileW - 3.4) / (Math.max(5, ...days.flatMap(d => tLines(d.time).map(l => l.length))) * 0.74))
    const dates = oh && days.length > 0 && (
      <Pick id={oh.id} sel={sel} style={{ position: 'absolute', top: u(-2.6), right: u(sq ? -0.8 : -3), ...((port || sq) && days.length > 1 ? { left: u(sq ? -0.8 : -3), justifyContent: 'space-between' } : {}), display: 'flex', gap: u(2.2), zIndex: 4 }}>
        {days.map((d, i) => (
          <div key={i} style={{ position: 'relative', width: u(tileW), transform: `rotate(${days.length > 1 ? (i ? 2 : port || sq ? -2 : -1.4) : 2}deg)`, filter: 'drop-shadow(0 0.9cqmin 1.8cqmin rgba(0,0,0,0.5))' }}>
            {[0.3, 0.7].map(x => <span key={x} aria-hidden style={{ position: 'absolute', top: u(-1), left: `${x * 100}%`, width: u(1), height: u(2.2), transform: 'translateX(-50%)', borderRadius: u(0.5), background: `linear-gradient(180deg, ${hexA('#FFFFFF', 0.85)}, ${gold})`, zIndex: 2 }} />)}
            <div style={{ overflow: 'hidden', borderRadius: u(0.7), border: `${hair} solid ${hexA(gold, 0.9)}`, background: t.isDark ? '#141820' : '#FFFDF8' }}>
              <div style={{ background: `linear-gradient(135deg, ${gold}, ${hexA(gold, 0.82)})`, padding: `${u(1.3)} ${u(0.8)} ${u(1.1)}`, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: u(0.9), whiteSpace: 'nowrap' }}>
                <span style={{ ...capsL, fontWeight: 800, letterSpacing: '0.14em', fontSize: u(days.length > 1 ? 1.9 : 2.1), color: t.isDark ? '#14161C' : '#FFFFFF' }}>{[d.wd.slice(0, 3), d.mon.slice(0, 3)].filter(Boolean).join(' · ')}</span>
                <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(days.length > 1 ? 4.4 : 4.9), lineHeight: 1, color: t.isDark ? '#14161C' : '#FFFFFF' }}>{d.day}</span>
              </div>
              {d.time && (
                <div style={{ padding: `${u(1.5)} ${u(0.8)} ${u(1.4)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.7) }}>
                  <span style={{ ...capsL, fontWeight: 700, letterSpacing: '0.05em', fontSize: u(tFs * 1.08), color: t.isDark ? ivory : '#16171B', textAlign: 'center' }}>{tLines(d.time).map((l, k) => <div key={k}>{l}</div>)}</span>
                  <LuxeDiamond size={0.8} color={gold} />
                </div>
              )}
            </div>
          </div>
        ))}
      </Pick>
    )
    const photo = (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', boxShadow: '0 2cqmin 5cqmin rgba(0,0,0,0.5)' }}>
          {c.photos[0]
            ? <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
            : <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 70% at 70% 20%, ${hexA(gold, 0.32)}, transparent 60%), linear-gradient(135deg, ${night(1)}, ${night(0.85)})` }} />}
          <div style={{ position: 'absolute', inset: u(1.4), border: `${hair} solid ${hexA('#FFFFFF', 0.55)}`, pointerEvents: 'none' }} />
        </div>
        {dates}
        {addr && (
          <Pick id={addr.id} sel={sel} style={{ position: 'absolute', left: '50%', bottom: 0, transform: st ? 'translate(-50%, 26%)' : 'translate(-50%, 50%)', zIndex: 3, width: 'max-content', maxWidth: u(LW + 4), background: night(1), border: `${hair} solid ${hexA(gold, 0.85)}`, boxShadow: '0 1.2cqmin 3cqmin rgba(0,0,0,0.45)', padding: `${u(1.6)} ${u(3.2)} ${u(1.8)}`, textAlign: 'center' }}>
            <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: u(aFs), lineHeight: 1.1, color: ivory }}>{aLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
            {c.sub && <div style={{ ...capsL, marginTop: u(0.9), fontWeight: 600, letterSpacing: '0.28em', paddingLeft: '0.28em', fontSize: u(sFs), color: gold }}>{c.sub.text}</div>}
          </Pick>
        )}
        {kPlate && (
          <Pick id={c.kicker?.id} sel={sel} style={{ position: 'absolute', left: '50%', bottom: 0, transform: st ? 'translate(-50%, 26%)' : 'translate(-50%, 50%)', zIndex: 3, width: 'max-content', maxWidth: u(LW + 4), background: night(1), border: `${hair} solid ${hexA(gold, 0.85)}`, boxShadow: '0 1.2cqmin 3cqmin rgba(0,0,0,0.45)', padding: `${u(1.9)} ${u(3.6)} ${u(2.1)}`, display: 'flex', alignItems: 'center', gap: u(kFs * 0.7) }}>
            <LuxeDiamond size={kFs * 0.32} color={gold} />
            <span style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 500, textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: '0.1em', fontSize: u(kFs), lineHeight: 1.15, color: ivory, whiteSpace: 'nowrap' }}>{kick}</span>
            <LuxeDiamond size={kFs * 0.32} color={gold} />
          </Pick>
        )}
      </div>
    )
    // the status: two words stack (ivory over gold) so each can be set big; one word stays one line
    const word = newsWord(c).toUpperCase()
    const wLines = st ? (word.includes(' ') ? splitLines(word, 2) : [word]) : !port && !sq && word.includes(' ') && word.length > 8 ? splitLines(word, 2) : [word]
    const headFs = Math.min(port ? 12.5 : st ? 15 : sq ? 10.6 : (wLines.length > 1 ? 10.5 : 11.5) + (c.logo ? 0 : 1.6), (sq ? inner : RW) / (Math.max(4, ...wLines.map(l => l.length)) * (t.styleId === 'modern_luxury' ? 0.76 : 0.68)))
    const qLines = c.leadGen && c.title ? splitLines(c.title.text.toUpperCase(), c.title.text.length > (port || sq ? 40 : 26) ? 3 : 2) : []
    const qFs = Math.min((st ? 8.4 : sq ? 7.2 : qLines.length > 2 ? 7.4 : 8.2) * (c.logo ? 0.86 : 1), (sq ? inner : RW) / (Math.max(6, ...qLines.map(l => l.length)) * 0.64))
    // the agent's note, broken into short promises - each sentence (and a ' - ' aside) on its own diamond row
    const promises = c.leadGen && c.sub ? (() => {
      const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
      const out: string[] = []
      for (const sen of c.sub.text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
        const parts = sen.split(/\s+[-–—]\s+/)
        for (const part of parts) {
          // one long sentence: break at its commas when every piece still reads on its own
          const bits = part.length > 80 ? part.split(/,\s+/) : [part]
          if (bits.length > 1 && bits.every(b => b.length >= 18)) bits.forEach(b => out.push(cap(b.replace(/^and\s+/i, '').replace(/[.,]$/, ''))))
          else out.push(cap(part.replace(/[.,]$/, '')))
        }
      }
      return out.slice(0, 4)
    })() : []
    // size the promises to the room left between the question and the QR card (never into the footer)
    const pFs = (() => {
      const room = st ? 36 : sq ? 30 : port ? 27 : 100 - padT - padB - 16 - 3.2 - (qLines.length * qFs * 1.05 + 4.5) - (14 + 5.6) - 5 - (c.logo ? 8 : 0)
      if (st) return 3.4
      for (let f = port ? 2.8 : 2.6; f > 1.8; f -= 0.1) {
        const perLine = (PW * 0.88) / (f * 0.5)
        const lines = promises.reduce((n, l) => n + Math.min(2, Math.ceil(l.length / perLine)), 0)
        if (lines * f * 1.3 + (promises.length - 1) * 1.5 <= room) return f
      }
      return 1.8
    })()
    const priceBlock = (c.price || facts) && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.3) }}>
        {c.price && (
          <Pick id={c.price.id} sel={sel}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.7) }}>
              {(c.price.label || c.situation === 'price_improvement') && <span style={{ ...capsL, fontWeight: 600, letterSpacing: '0.34em', paddingLeft: '0.34em', fontSize: u(1.9), color: hexA(ivory, 0.7) }}>{c.price.label || 'Now Offered At'}</span>}
              <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(Math.min(8.4 * c.price.o.k, (PW * 0.86) / (c.price.value.length * 0.56))), lineHeight: 1, color: gold, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
              {c.price.previous && <span style={{ ...capsL, fontSize: u(2), color: hexA(ivory, 0.55), textDecoration: 'line-through' }}>{c.price.previous}</span>}
            </div>
          </Pick>
        )}
        {facts && <LuxeFacts c={c} t={t} gold={gold} size={Math.min(2.5, (PW * 0.92) / (facts.items.map(i => `${i.value} ${i.label}`).join('    ').length * 0.62))} sel={sel} />}
      </div>
    )
    const descB = c.details.find(d => d.kind === 'description') as Extract<DetailItem, { kind: 'description' }> | undefined
    const askCta = c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined
    const askT = (askCta?.label || (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo')).replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())
    const qs = c.leadGen ? 14 : 11
    // the ask on one line when short, else two even lines (never a lone first word)
    const askLines = (() => {
      const w = askT.split(/\s+/)
      if (askT.length <= (st ? 32 : 19) || w.length < 2) return [askT]
      let best = [askT], worst = Infinity
      for (let k = 1; k < w.length; k++) {
        const l = [w.slice(0, k).join(' '), w.slice(k).join(' ')], m = Math.max(l[0].length, l[1].length)
        if (m < worst && !/\s(in|at|of|for|to|on|the)$/i.test(' ' + l[0])) { worst = m; best = l }
      }
      return best
    })()
    const askFs = Math.min(c.leadGen ? 4.6 : 4.2, (RW - qs - 13) / (Math.max(...askLines.map(l => l.length)) * 0.44))
    const qrCard = c.qr && (
      <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ alignSelf: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: u(3), background: cardBg, border: `${hair} solid ${hexA(gold, 0.6)}`, padding: `${u(2)} ${u(3.4)} ${u(2)} ${u(2)}` }}>
          <div style={{ flexShrink: 0, padding: u(0.8), background: '#FFFFFF', outline: `${hair} solid ${hexA(gold, 0.9)}`, outlineOffset: u(0.7) }}><Qr c={c} t={t} ink={{ ...ink, ink: '#111111' }} size={qs} sel={sel} labelSide="none" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(1.1), minWidth: 0 }}>
            <div style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: u(askFs), lineHeight: 1.08, color: ivory }}>{askLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...capsL, display: 'block', fontWeight: 700, letterSpacing: '0.2em', fontSize: u(Math.min(2, (RW - qs - 15) / (c.qr.label.length * 0.86))), color: gold }}>{c.qr.label}</span></Pick>}
          </div>
        </div>
      </Pick>
    )
    const footer = (c.agent || c.finePrint) && (
      <div data-foot="" style={{ display: 'flex', flexDirection: 'column', gap: u(1.3), width: '100%', position: 'relative', zIndex: 3 }}>
        <span aria-hidden style={{ display: 'block', height: hair, width: '100%', background: `linear-gradient(90deg, transparent, ${hexA(gold, 0.75)} 12%, ${hexA(gold, 0.75)} 88%, transparent)` }} />
        {c.agent && st && (() => {
          // story footer (user 10/13): the agent centred, then ONE contact line - phone, a gold diamond, the email
          const a = c.agent!
          const mail = a.email || a.website || ''
          const line = [a.phone, mail].filter(Boolean).join('   ')
          const cfs = Math.min(2.6, (inner * 0.94) / (Math.max(18, line.length) * 0.56))
          const cs: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(cfs), color: ivory, whiteSpace: 'nowrap', lineHeight: 1.2, fontVariantNumeric: 'lining-nums' }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6), padding: `${u(0.8)} 0 ${u(0.2)}` }}>
              <AgentCard fitLong c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={1.25} showContact={false} noTitle />
              {(a.phone || mail) && (
                <Pick id={a.id} sel={sel}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(1.8) }}>
                    {a.phone && <Tel kind="mobile" num={a.phone} style={cs} />}
                    {a.phone && mail && <LuxeDiamond size={0.9} color={gold} />}
                    {mail && <span style={{ ...cs, fontWeight: 600 }}>{mail}</span>}
                  </div>
                </Pick>
              )}
            </div>
          )
        })()}
        {c.agent && !st && (
          <div style={{ display: 'flex', alignItems: 'center', gap: u(3) }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}><AgentCard fitLong c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={!print ? 1.12 : 0.92} showContact={false} noTitle /></div>
            <div style={{ flexShrink: 0 }}><SplitContacts splitMail c={c} t={t} ink={ink} S={S} sel={sel} scale={!print ? 0.8 : 0.62} /></div>
          </div>
        )}
        <FinePrint c={c} ink={ink} t={t} size={S.fine} oneLine={!st} align={st ? 'center' : 'left'} />
      </div>
    )
    // the brokerage name already sits (bold, with the office phone) in the agent bar - only an uploaded logo shows up here
    const brandRow = c.logo && brand && <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>{brand}</div>
    const promiseRows = promises.length > 0 && c.sub && (
      <Pick id={c.sub.id} sel={sel} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(port ? 2 : 1.5), maxWidth: '96%' }}>
          {promises.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: u(1.6), textAlign: 'left', fontSize: u(pFs), lineHeight: 1.3 }}>
              <span style={{ flexShrink: 0, height: u(pFs * 1.3), display: 'flex', alignItems: 'center', lineHeight: 0 }}><LuxeDiamond size={pFs * 0.36} color={gold} /></span>
              <span style={{ fontFamily: t.fonts.body, fontWeight: 500, fontSize: u(pFs), lineHeight: 1.3, color: hexA(ivory, 0.9), textWrap: 'balance' as CSSProperties['textWrap'], display: '-webkit-box', WebkitLineClamp: sq ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l}</span>
            </div>
          ))}
        </div>
      </Pick>
    )
    // social has no QR: the ask sits in a fine gold box
    const askW = port ? QW : RW
    const askBox = !c.qr && askCta && (
      <Pick id={askCta.id} sel={sel} style={{ maxWidth: '100%', flexShrink: 0 }}>
        <div style={{ border: `${hair} solid ${hexA(gold, 0.85)}`, background: cardBg, padding: `${u(port ? 2.2 : 1.5)} ${u(port ? 2.8 : 2.2)}`, textAlign: 'center', fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: u(Math.min(st ? 4.4 : port ? 3.8 : 3.2, (askW - 5) / (Math.max(...askLines.map(l => l.length)) * 0.44))), lineHeight: 1.1, color: ivory }}>{askLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
      </Pick>
    )
    if (sq) {
      const wordParts = word.split(' ')
      return (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(80% 50% at 50% 25%, ${hexA(gold, t.isDark ? 0.1 : 0.06)}, transparent 70%), ${night(1)}` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `${u(padT)} ${u(padX)} ${u(padB)}`, gap: u(2.8), zIndex: 2 }}>
            {brandRow}
            {c.leadGen ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.8), textAlign: 'center' }}>
                {c.title && <Pick id={c.title.id} sel={sel}><div>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.03em', fontSize: u(qFs), lineHeight: 1.05, color: i % 2 ? gold : ivory, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
                {ornament(inner * 0.36)}
              </div>
            ) : (
              <Pick id={c.big?.id || c.kicker?.id} sel={sel}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6) }}>
                  {st && wLines.length > 1
                    ? <div style={{ textAlign: 'center' }}>{wLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.07em', paddingLeft: '0.07em', fontSize: u(headFs), lineHeight: 1.02, color: i === 0 ? ivory : gold, whiteSpace: 'nowrap' }}>{l}</div>)}</div>
                    : <div style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.07em', paddingLeft: '0.07em', fontSize: u(headFs), lineHeight: 1, whiteSpace: 'nowrap' }}>
                    {wordParts.length > 1 ? <><span style={{ color: ivory }}>{wordParts[0]}</span> <span style={{ color: gold }}>{wordParts.slice(1).join(' ')}</span></> : <span style={{ color: gold }}>{word}</span>}
                  </div>}
                  {ornament(inner * 0.4)}
                </div>
              </Pick>
            )}
            {c.leadGen && st ? (
              <>
                <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', paddingBottom: u(kPlate ? kPlateH * 0.26 + 2.6 : 0) }}>{photo}</div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2.4), textAlign: 'center' }}>
                  {askBox}
                  {askBox && ornament(inner * 0.5)}
                  {/* story (user 10/13): the promises sit centred as a group in a fine gold-keylined card */}
                  {promiseRows && <div style={{ maxWidth: '90%', border: `${hair} solid ${hexA(gold, 0.45)}`, background: cardBg, padding: `${u(2.6)} ${u(3.4)}` }}>{promiseRows}</div>}
                </div>
              </>
            ) : c.leadGen ? (
              // lead-gen (user 10/13): photo + plate on the left; the promises up top, a gold rule, then the ask box
              <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', gap: u(gapC) }}>
                <div style={{ width: u(LW), flexShrink: 0, display: 'flex', flexDirection: 'column', paddingBottom: u(kPlate ? kPlateH / 2 + 0.6 : 0) }}>{photo}</div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: u(3), paddingTop: u(ar < 0.95 ? 4 : 2.4), textAlign: 'center' }}>
                  {/* 4:5 (user 10/13): the ask leads, a gold rule, then the promises; the square keeps promises first */}
                  {ar < 0.95 && askBox}
                  {ar < 0.95 && askBox && ornament(RW * 0.72)}
                  {promiseRows}
                  {ar >= 0.95 && askBox && ornament(RW * 0.72)}
                  {ar >= 0.95 && askBox}
                </div>
              </div>
            ) : (
              // listings (user 10/13): the photo right under the header, full width, then the price beside the stats
              <>
                <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', paddingTop: u(dates ? 2.4 : 0), paddingBottom: u(addr ? (st ? plateH * 0.26 + 2.6 : plateH / 2 + 0.6) : 0) }}>{photo}</div>
                {(c.price || facts) && (
                  <div style={{ display: 'flex', flexDirection: st ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: u(st ? 2 : 3.6), maxWidth: '100%' }}>
                    {c.price && (
                      <Pick id={c.price.id} sel={sel}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.7) }}>
                          {(c.price.label || c.situation === 'price_improvement') && <span style={{ ...capsL, fontWeight: 600, letterSpacing: '0.3em', paddingLeft: '0.3em', fontSize: u(1.8), color: hexA(ivory, 0.7) }}>{c.price.label || 'Now Offered At'}</span>}
                          <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(Math.min((st ? 9.5 : 6.8) * c.price.o.k, (inner * (st ? 0.8 : 0.42)) / (c.price.value.length * 0.56))), lineHeight: 1, color: gold, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
                          {c.price.previous && <span style={{ ...capsL, fontSize: u(1.7), color: hexA(ivory, 0.55), textDecoration: 'line-through' }}>{c.price.previous}</span>}
                        </div>
                      </Pick>
                    )}
                    {c.price && facts && !st && <span aria-hidden style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.8) }}><span style={{ flex: 1, width: hair, background: `linear-gradient(180deg, transparent, ${hexA(gold, 0.7)})` }} /><LuxeDiamond size={1} color={gold} /><span style={{ flex: 1, width: hair, background: `linear-gradient(0deg, transparent, ${hexA(gold, 0.7)})` }} /></span>}
                    {c.price && facts && st && ornament(inner * 0.5)}
                    {facts && <LuxeFacts c={c} t={t} gold={gold} size={Math.min(st ? 3.4 : 2.8, (inner * (st ? 0.9 : 0.46)) / (facts.items.map(i => `${i.value} ${i.label}`).join('    ').length * 0.56))} sel={sel} />}
                  </div>
                )}
              </>
            )}
            {footer}
          </div>
          <LuxeGoldFrame inset={2.8} gold={gold} />
        </>
      )
    }
    if (port) {
      const qsP = c.leadGen ? 14 : 13
      const askP = (() => {
        const w = askT.split(/\s+/)
        if (askT.length <= 16 || w.length < 2) return [askT]
        let best = [askT], worst = Infinity
        for (let k = 1; k < w.length; k++) {
          const l = [w.slice(0, k).join(' '), w.slice(k).join(' ')], m = Math.max(l[0].length, l[1].length)
          if (m < worst && !/\s(in|at|of|for|to|on|the)$/i.test(' ' + l[0])) { worst = m; best = l }
        }
        return best
      })()
      const askPFs = Math.min(4.2, (QW - 5) / (Math.max(...askP.map(l => l.length)) * 0.44))
      const qrTall = c.qr && (
        <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ flexShrink: 0, width: u(QW) }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6), background: cardBg, border: `${hair} solid ${hexA(gold, 0.6)}`, padding: `${u(2.6)} ${u(1.6)} ${u(2.4)}`, textAlign: 'center' }}>
            <div style={{ padding: u(0.8), background: '#FFFFFF', outline: `${hair} solid ${hexA(gold, 0.9)}`, outlineOffset: u(0.7) }}><Qr c={c} t={t} ink={{ ...ink, ink: '#111111' }} size={qsP} sel={sel} labelSide="none" /></div>
            <div style={{ marginTop: u(0.6), fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: u(askPFs), lineHeight: 1.08, color: ivory }}>{askP.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...capsL, display: 'block', fontWeight: 700, letterSpacing: '0.18em', fontSize: u(Math.min(1.9, (QW - 4) / (c.qr.label.length * 0.84))), color: gold }}>{c.qr.label}</span></Pick>}
          </div>
        </Pick>
      )
      const wordParts = word.split(' ')
      return (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(80% 40% at 50% 22%, ${hexA(gold, t.isDark ? 0.1 : 0.06)}, transparent 70%), ${night(1)}` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `${u(padT)} ${u(padX)} ${u(padB)}`, gap: u(3.4), zIndex: 2 }}>
            {brandRow}
            {c.leadGen ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2.2), textAlign: 'center' }}>
                {c.title && <Pick id={c.title.id} sel={sel}><div>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.03em', fontSize: u(qFs), lineHeight: 1.05, color: i % 2 ? gold : ivory, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
                {ornament(inner * 0.4)}
              </div>
            ) : (
              <Pick id={c.big?.id || c.kicker?.id} sel={sel}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2) }}>
                  <div style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.07em', paddingLeft: '0.07em', fontSize: u(headFs), lineHeight: 1, whiteSpace: 'nowrap' }}>
                    {wordParts.length > 1 ? <><span style={{ color: ivory }}>{wordParts[0]}</span> <span style={{ color: gold }}>{wordParts.slice(1).join(' ')}</span></> : <span style={{ color: gold }}>{word}</span>}
                  </div>
                  {ornament(inner * 0.46)}
                </div>
              </Pick>
            )}
            <div style={{ flex: 1, minHeight: u(30), width: u(LW), display: 'flex', flexDirection: 'column', paddingBottom: u(addr ? plateH / 2 + 0.6 : kPlate ? kPlateH / 2 + 0.6 : 0) }}>{photo}</div>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: u(3) }}>
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(2.6), textAlign: 'center' }}>
                {c.leadGen ? promiseRows : <>
                  {c.price && (
                    <Pick id={c.price.id} sel={sel}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.9) }}>
                        {(c.price.label || c.situation === 'price_improvement') && <span style={{ ...capsL, fontWeight: 600, letterSpacing: '0.34em', paddingLeft: '0.34em', fontSize: u(1.9), color: hexA(ivory, 0.7) }}>{c.price.label || 'Now Offered At'}</span>}
                        <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(Math.min(8.8 * c.price.o.k, (PW * 0.86) / (c.price.value.length * 0.56))), lineHeight: 1, color: gold, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
                        {c.price.previous && <span style={{ ...capsL, fontSize: u(2), color: hexA(ivory, 0.55), textDecoration: 'line-through' }}>{c.price.previous}</span>}
                      </div>
                    </Pick>
                  )}
                  {/* the stats sit in their own band - gold hairlines above and below, a diamond at each end */}
                  {facts && (
                    <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%', padding: `${u(1.7)} ${u(2.6)}`, display: 'flex', justifyContent: 'center' }}>
                      {(['top', 'bottom'] as const).map(edge => (
                        <div key={edge} aria-hidden style={{ position: 'absolute', left: 0, right: 0, [edge]: 0, display: 'flex', alignItems: 'center', gap: u(1) }}>
                          <LuxeDiamond size={0.9} color={gold} />
                          <span style={{ flex: 1, height: hair, background: hexA(gold, 0.5) }} />
                          <LuxeDiamond size={0.9} color={gold} />
                        </div>
                      ))}
                      <LuxeFacts c={c} t={t} gold={gold} size={Math.min(2.8, (PW * 0.95) / (facts.items.map(i => `${i.value} ${i.label}`).join('    ').length * 0.56))} sel={sel} />
                    </div>
                  )}
                  {descB && <Pick id={descB.id} sel={sel} style={{ maxWidth: u(PW * 0.94) }}><div style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: u(Math.min(2.9, S.body * 1.12)), lineHeight: 1.4, color: hexA(ivory, 0.88), textAlign: 'center', textWrap: 'balance' as CSSProperties['textWrap'], display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{descB.text}</div></Pick>}
                </>}
              </div>
              {qrTall || askBox}
            </div>
            {footer}
          </div>
          <LuxeGoldFrame inset={3.2} gold={gold} />
        </>
      )
    }
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 70% at 74% 40%, ${hexA(gold, t.isDark ? 0.1 : 0.06)}, transparent 70%), ${night(1)}` }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: `${u(padT)} ${u(padX)} ${u(padB)}`, gap: u(3.2), zIndex: 2 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(gapC) }}>
            <div style={{ width: u(LW), flexShrink: 0, display: 'flex', flexDirection: 'column', paddingBottom: u(addr ? plateH / 2 + 0.6 : kPlate ? kPlateH / 2 + 0.6 : 0) }}>{photo}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center', gap: u(2) }}>
              {brandRow}
              {c.leadGen ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2), width: '100%' }}>
                  {c.title && <Pick id={c.title.id} sel={sel}><div>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.03em', fontSize: u(qFs), lineHeight: 1.05, color: i % 2 ? gold : ivory, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
                  {ornament(RW * 0.5)}
                </div>
              ) : (
                <Pick id={c.big?.id || c.kicker?.id} sel={sel}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6) }}>
                    <div>{wLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.07em', paddingLeft: '0.07em', fontSize: u(headFs), lineHeight: 1, color: wLines.length > 1 && i === 0 ? ivory : gold, whiteSpace: 'nowrap' }}>{l}</div>)}</div>
                    {ornament(RW * 0.6)}
                  </div>
                </Pick>
              )}
              {!c.leadGen && priceBlock}
              {promiseRows}
              {qrCard}
            </div>
          </div>
          {footer}
        </div>
        <LuxeGoldFrame inset={3.2} gold={gold} />
      </>
    )
  }

  if (wide) {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: night(1) }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '61%' }}>
          {photoLayer(`linear-gradient(270deg, ${night(1)} 0%, ${night(1)} 4%, ${night(0.55)} 20%, ${night(0)} 44%), linear-gradient(180deg, ${night(0.35)} 0%, ${night(0)} 30%)`)}
          {/* A solid edge a hair past the photo, so its last pixel column can't show as a seam. */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: -2, width: '4%', background: night(1) }} />
          {brand && <div style={{ position: 'absolute', left: u(P * 1.1), top: u(P * 0.95), zIndex: 3 }}>{brand}</div>}
        </div>
        <div style={{ position: 'absolute', right: u(P * 0.95), top: 0, bottom: 0, width: '39%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: u(S.gap * 1.4), padding: `${u(P * 0.9)} 0`, zIndex: 3 }}>
          {plate(fam === 'banner' ? 0.85 : (c.title?.text.length || 0) > 22 && (oh || print) ? 0.96 : 1.12, 'panel')}
          {fam !== 'banner' && signOff(0.9)}
        </div>
        <LuxeGoldFrame inset={P * 0.4} gold={gold} />
      </>
    )
  }

  // Door hanger (user 10/12 rebuild): the approved door-hanger order - status, the photo with its address
  // plate, the price, the QR, the agent - set the Luxe way: midnight, fine gold keylines, serif type, and a
  // gold ring drawn around the die-cut hole so the hole reads as part of the design.
  if (tall && print) {
    const W = 100 - P * 2
    const ivory = ink.ink
    const capsL: CSSProperties = { fontFamily: t.fonts.label, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.15 }
    const cardBg = hexA(ivory, t.isDark ? 0.045 : 0.035)
    // spaced caps between gold rules - sized from the text so it can never run off the hanger
    const kickLine = (text: string, size: number, id?: string) => {
      const ls = 0.3
      const fs = Math.min(size, (W - 16) / (Math.max(4, text.length) * (0.66 + ls)))
      return (
        <Pick id={id} sel={sel} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(fs * 0.7), width: '100%' }}>
            <span style={{ flex: '1 1 0', maxWidth: u(14), height: hair, background: `linear-gradient(90deg, transparent, ${gold})` }} />
            <LuxeDiamond size={fs * 0.42} color={gold} />
            <span style={{ ...capsL, fontWeight: 600, letterSpacing: `${ls}em`, paddingLeft: `${ls}em`, fontSize: u(fs), color: gold }}>{text}</span>
            <LuxeDiamond size={fs * 0.42} color={gold} />
            <span style={{ flex: '1 1 0', maxWidth: u(14), height: hair, background: `linear-gradient(270deg, transparent, ${gold})` }} />
          </div>
        </Pick>
      )
    }
    const ornament = (w: number) => (
      <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(1.4), width: u(w) }}>
        <span style={{ flex: 1, height: hair, background: `linear-gradient(90deg, transparent, ${hexA(gold, 0.8)})` }} />
        <LuxeDiamond size={1.5} color={gold} />
        <span style={{ flex: 1, height: hair, background: `linear-gradient(270deg, transparent, ${hexA(gold, 0.8)})` }} />
      </div>
    )
    // the hole: 1.25in, its top 0.5in down on a 4.25in-wide piece - a double gold ring sits just outside it
    const holeC = (0.5 + 0.625) / 4.25 * 100, ringD = 1.5 / 4.25 * 100
    const ring = (
      <div aria-hidden style={{ position: 'absolute', left: '50%', top: u(holeC), width: u(ringD), height: u(ringD), transform: 'translate(-50%, -50%)', zIndex: 3, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${hair} solid ${hexA(gold, 0.85)}` }} />
        <div style={{ position: 'absolute', inset: u(1.5), borderRadius: '50%', border: `${hair} solid ${hexA(gold, 0.32)}` }} />
        <span style={{ position: 'absolute', left: '50%', bottom: u(-1), width: u(2), height: u(2), background: gold, transform: 'translateX(-50%) rotate(45deg)' }} />
      </div>
    )
    // the photo in a fine gold keyline; listings hang the address on a midnight plate off its bottom edge
    const addr = c.title?.isAddress ? c.title : null
    const photoW = W * (c.leadGen ? 0.9 : oh ? 0.84 : 0.88)
    const aLines = addr ? (addr.text.length > 24 ? splitLines(addr.text, 2) : [addr.text]) : []
    const aFs = addr ? Math.min(7.2, (W * 0.9) / (Math.max(...aLines.map(l => l.length)) * 0.6)) : 0
    const sFs = c.sub ? Math.min(3, (W * 0.84) / (c.sub.text.length * 0.98)) : 0
    const plateH = addr ? aFs * 1.1 * aLines.length + (c.sub ? sFs * 1.4 + 1 : 0) + 4.4 : 0
    const framed = (aspect: string, width: number) => (
      <div style={{ position: 'relative', flexShrink: 0, width: u(width), marginBottom: addr ? u(plateH / 2) : 0 }}>
        <div style={{ position: 'relative', aspectRatio: aspect, overflow: 'hidden', boxShadow: '0 2.4cqmin 6cqmin rgba(0,0,0,0.5)' }}>
          {c.photos[0]
            ? <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
            : <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 70% at 70% 20%, ${hexA(gold, 0.32)}, transparent 60%), linear-gradient(135deg, ${night(1)}, ${night(0.85)})` }} />}
          <div style={{ position: 'absolute', inset: u(1.6), border: `${hair} solid ${hexA('#FFFFFF', 0.55)}`, pointerEvents: 'none' }} />
        </div>
        {addr && (
          <Pick id={addr.id} sel={sel} style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)', zIndex: 3, width: 'max-content', maxWidth: u(W + 2), background: night(1), border: `${hair} solid ${hexA(gold, 0.85)}`, boxShadow: '0 1.2cqmin 3cqmin rgba(0,0,0,0.45)', padding: `${u(2.2)} ${u(4.4)} ${u(2.4)}`, textAlign: 'center' }}>
            <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: u(aFs), lineHeight: 1.1, color: ivory }}>{aLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
            {c.sub && <div style={{ ...capsL, marginTop: u(1), fontWeight: 600, letterSpacing: '0.28em', paddingLeft: '0.28em', fontSize: u(sFs), color: gold }}>{c.sub.text}</div>}
          </Pick>
        )}
      </div>
    )
    // open house: dated tiles - weekday, the day big in serif, the time in gold
    const days = oh ? (() => {
      const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
      const ds = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
      const ts = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
      return ds.map((d, k) => {
        const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
        const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
        return { wd, mon: m ? m[1] : '', day: m ? m[2] : rest, time: ts.length > 1 ? ts[k] ?? '' : ts[0] ?? '' }
      })
    })() : []
    const tileW = days.length > 1 ? (W * 0.74 - 3.4) / 2 : W * 0.4
    const tFs = Math.min(2.5, (tileW - 4) / (Math.max(5, ...days.map(d => d.time.length)) * 0.74))
    // a real little calendar, same footprint as before: a gold header band with the weekday + month + date on
    // one line, two binding rings on top, the time set in ivory below - gold keyline, soft shadow, a slight tilt
    const dates = oh && days.length > 0 && (
      <Pick id={oh.id} sel={sel} style={{ display: 'flex', justifyContent: 'center', gap: u(3.4), paddingTop: u(1.2) }}>
        {days.map((d, i) => (
          <div key={i} style={{ position: 'relative', width: u(tileW), transform: `rotate(${days.length > 1 ? (i ? 1.6 : -1.6) : 0}deg)`, filter: 'drop-shadow(0 0.9cqmin 1.8cqmin rgba(0,0,0,0.45))' }}>
            {[0.3, 0.7].map(x => <span key={x} aria-hidden style={{ position: 'absolute', top: u(-1.1), left: `${x * 100}%`, width: u(1.1), height: u(2.4), transform: 'translateX(-50%)', borderRadius: u(0.6), background: `linear-gradient(180deg, ${hexA('#FFFFFF', 0.85)}, ${gold})`, zIndex: 2 }} />)}
            <div style={{ overflow: 'hidden', borderRadius: u(0.8), border: `${hair} solid ${hexA(gold, 0.9)}`, background: t.isDark ? '#141820' : '#FFFDF8' }}>
              <div style={{ background: `linear-gradient(135deg, ${gold}, ${hexA(gold, 0.82)})`, padding: `${u(1.5)} ${u(1)} ${u(1.3)}`, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: u(1.1), whiteSpace: 'nowrap' }}>
                <span style={{ ...capsL, fontWeight: 800, letterSpacing: '0.16em', fontSize: u(2.4), color: t.isDark ? '#14161C' : '#FFFFFF' }}>{[d.wd.slice(0, 3), d.mon.slice(0, 3)].filter(Boolean).join(' · ')}</span>
                <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(5.6), lineHeight: 1, color: t.isDark ? '#14161C' : '#FFFFFF' }}>{d.day}</span>
              </div>
              {d.time && (
                <div style={{ padding: `${u(1.9)} ${u(1)} ${u(1.8)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.8) }}>
                  <span style={{ ...capsL, fontWeight: 700, letterSpacing: '0.05em', fontSize: u(tFs * 1.12), color: t.isDark ? ivory : '#16171B' }}>{d.time}</span>
                  <LuxeDiamond size={0.9} color={gold} />
                </div>
              )}
            </div>
          </div>
        ))}
      </Pick>
    )
    const priceBlock = (c.price || facts) && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6) }}>
        {c.price && (
          <Pick id={c.price.id} sel={sel}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.8) }}>
              {(c.price.label || c.situation === 'price_improvement') && <span style={{ ...capsL, fontWeight: 600, letterSpacing: '0.34em', paddingLeft: '0.34em', fontSize: u(2.3), color: hexA(ivory, 0.7) }}>{c.price.label || 'Now Offered At'}</span>}
              <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(Math.min(11 * c.price.o.k, (W * 0.84) / (c.price.value.length * 0.56))), lineHeight: 1, color: gold, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
              {c.price.previous && <span style={{ ...capsL, fontSize: u(2.4), color: hexA(ivory, 0.55), textDecoration: 'line-through' }}>{c.price.previous}</span>}
            </div>
          </Pick>
        )}
        {c.price && facts && ornament(W * 0.56)}
        {facts && <LuxeFacts c={c} t={t} gold={gold} size={Math.min(3, (W * 0.9) / (facts.items.map(i => `${i.value} ${i.label}`).join('    ').length * 0.62))} sel={sel} />}
      </div>
    )
    const descB = c.details.find(d => d.kind === 'description') as Extract<DetailItem, { kind: 'description' }> | undefined
    const askCta = c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined
    const askT = (askCta?.label || (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo')).replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())
    const qs = S.qr * (c.leadGen ? 1.15 : 0.95)
    const askLines = (() => {
      if (askT.length <= 18) return [askT]
      const l = splitLines(askT, 2)
      const m = l.length === 2 ? l[0].match(/^(.*)\s(in|at|of|for|to|on|the|a|your)$/i) : null
      return m ? [m[1], `${m[2]} ${l[1]}`] : l
    })()
    const askFs = Math.min(c.leadGen ? 6 : 5.4, (W - qs - 16) / (Math.max(...askLines.map(l => l.length)) * 0.44))
    const qrCard = c.qr && (
      <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ alignSelf: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: u(4), background: cardBg, border: `${hair} solid ${hexA(gold, 0.6)}`, padding: `${u(2.6)} ${u(4.2)} ${u(2.6)} ${u(2.6)}` }}>
          <div style={{ flexShrink: 0, padding: u(1), background: '#FFFFFF', outline: `${hair} solid ${hexA(gold, 0.9)}`, outlineOffset: u(0.8) }}><Qr c={c} t={t} ink={{ ...ink, ink: '#111111' }} size={qs} sel={sel} labelSide="none" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(1.4), minWidth: 0 }}>
            <div style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: u(askFs), lineHeight: 1.08, color: ivory }}>{askLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...capsL, display: 'block', fontWeight: 700, letterSpacing: '0.2em', fontSize: u(Math.min(2.5, (W - qs - 18) / (c.qr.label.length * 0.86))), color: gold }}>{c.qr.label}</span></Pick>}
          </div>
        </div>
      </Pick>
    )
    const word = newsWord(c).toUpperCase()
    const headFs = Math.min(13, W / (Math.max(5, word.length) * (t.styleId === 'modern_luxury' ? 0.78 : 0.7)))
    const qLines = c.leadGen && c.title ? splitLines(c.title.text.toUpperCase(), 2) : []
    const qFs = Math.min(8.6, W / (Math.max(6, ...qLines.map(l => l.length)) * 0.66))
    const footer = (c.agent || c.finePrint) && (
      <div data-foot="" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6), marginTop: u(3) }}>
        {ornament(W * 0.7)}
        {c.agent && <AgentCard fitLong c={c} t={t} ink={ink} S={S} sel={sel} align="center" scale={1.05} showContact={false} noTitle />}
        {c.agent && <SplitContacts splitMail c={c} t={t} ink={ink} S={S} sel={sel} scale={0.9} />}
        <FinePrint c={c} ink={ink} t={t} size={S.fine} align="center" />
      </div>
    )
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 40% at 50% 30%, ${hexA(gold, t.isDark ? 0.1 : 0.06)}, transparent 70%), ${night(1)}` }} />
        {ring}
        {brand && <div style={{ position: 'absolute', left: 0, right: 0, top: u(holeC + ringD / 2 + 3.5), display: 'flex', justifyContent: 'center', zIndex: 3 }}>{brand}</div>}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `${u(holeC + ringD / 2 + (brand ? 11 : 5))} ${u(P)} ${u(P * 0.95)}`, zIndex: 2 }}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', gap: u(3) }}>
            {c.leadGen ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2.4), width: '100%', textAlign: 'center' }}>
                {kick && kickLine(kick, 3.2, c.kicker?.id)}
                {c.title && <Pick id={c.title.id} sel={sel}><div>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.03em', fontSize: u(qFs), lineHeight: 1.05, color: i % 2 ? gold : ivory, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
                {c.sub && <div style={{ width: '90%' }}><Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.12} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} /></div>}
              </div>
            ) : (
              <Pick id={c.big?.id || c.kicker?.id} sel={sel}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2) }}>
                  <div style={{ fontFamily: t.fonts.display, fontWeight: 500, letterSpacing: '0.08em', paddingLeft: '0.08em', fontSize: u(headFs), lineHeight: 1, color: gold, whiteSpace: 'nowrap' }}>{word}</div>
                  {ornament(W * 0.62)}
                </div>
              </Pick>
            )}
            {framed('3 / 2', photoW)}
            {dates}
            {priceBlock}
            {!oh && !c.leadGen && descB && <Pick id={descB.id} sel={sel} style={{ width: '90%' }}><Lede text={descB.text} t={t} ink={ink} size={S.body} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} /></Pick>}
            {qrCard}
          </div>
          {footer}
        </div>
        <LuxeGoldFrame inset={P * 0.42} gold={gold} />
      </>
    )
  }

  // Vertical formats: photo above, midnight plate below. Stories keep everything clear of the
  // Instagram header and reply bar; the door hanger leaves its hole zone empty.
  const photoPct = story ? 56 : tall ? (c.leadGen ? 47 : 36) : fam === 'portrait' ? 52 : 58
  const k = story ? 1.22 : tall ? (c.leadGen ? 1.38 : 1.18) : fam === 'portrait' ? 1.1 : 1.14
  const topPad = tall ? HANGER_ZONE + 6 : story ? 13 : P * 0.95
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: night(1) }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: `0 0 ${photoPct}%` }}>
          {photoLayer(c.townOnly
            ? `linear-gradient(0deg, ${night(1)} 0%, ${night(0.6)} 10%, ${night(0)} 30%), linear-gradient(180deg, ${night(0.4)} 0%, ${night(0)} 22%)`
            : `linear-gradient(0deg, ${night(1)} 0%, ${night(0.7)} 14%, ${night(0)} 42%), linear-gradient(180deg, ${night(0.5)} 0%, ${night(0)} 26%)`)}
          {brand && <div style={{ position: 'absolute', left: 0, right: 0, top: u(topPad), display: 'flex', justifyContent: 'center', zIndex: 3 }}>{brand}</div>}
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, marginTop: u(-S.kicker * 2.4 * k), padding: `0 ${u(P * 1.05)} ${u(story ? 17 : P * 0.95)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.9), zIndex: 3 }}>
          {/* The story centered in the room above the sign-off - no dead band in between. */}
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: c.townOnly ? 'flex-end' : 'center', gap: u(S.gap * 1.1), paddingBottom: c.townOnly ? u(S.gap * 0.5) : 0 }}>
            {plate(k, 'full')}
            {(fam === 'portrait' || tall) && print && (
              <div style={{ width: '88%', overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={scaled(S, 0.95)} align="center" sel={sel} only={['description']} clamp={tall ? 4 : 3} /></div>
            )}
          </div>
          {signOff(story ? 1.05 : 1)}
        </div>
      </div>
      <LuxeGoldFrame inset={P * 0.42} gold={gold} />
    </>
  )
}

// ── Magazine Cover: a masthead set across the top of the photo, cover lines, the agent as byline.
function Magazine({ c, t, fam, S, sel }: CompProps) {
  if (fam === 'tall' || fam === 'banner') return <Cinematic c={c} t={t} fam={fam} S={S} sel={sel} />
  const P = S.pad
  const onPhoto = inkDeep(t)
  const dk = deepTone(t)
  const T = tones(t)
  const word = (c.leadGen ? c.kicker?.text : c.big?.text) || c.kicker?.text || ''
  const story = fam === 'story'
  const land = fam === 'landscape'
  const portrait = fam === 'portrait'
  // Width the masthead may use, in cqmin (the canvas short side = 100).
  const usable = land ? 100 * 0.62 * 1.3 : 100 - P * 2
  const charW = t.styleId === 'bold' ? 0.47 : t.styleId === 'modern_luxury' ? 0.74 : t.styleId === 'minimal' ? 0.62 : 0.58
  const mastFs = Math.min(story ? 30 : 27, usable / Math.max(word.length, 3) / charW)
  const facts = findFacts(c)
  const oh = findOpenHouse(c)
  const bandH = portrait ? 19 : 0
  const top = story ? 12 : P * 0.55
  const bottom = story ? (c.townOnly ? '12%' : '14%') : portrait ? `${bandH}%` : u(P * (c.townOnly ? 0.5 : 0.7))
  return (
    <>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: portrait ? `${bandH}%` : 0 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: portrait ? `${bandH}%` : 0, background: c.townOnly
        ? `linear-gradient(180deg, rgba(${dk},0.62) 0%, rgba(${dk},0.1) 30%, rgba(${dk},0) 46%, rgba(${dk},0.32) 60%, rgba(${dk},0.78) 78%, rgba(${dk},0.92) 100%)`
        : `linear-gradient(180deg, rgba(${dk},0.62) 0%, rgba(${dk},0.1) 30%, rgba(${dk},0) 42%, rgba(${dk},0.34) 56%, rgba(${dk},0.8) 76%, rgba(${dk},0.94) 100%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: u(P), right: land ? '34%' : u(P), top: story ? '12%' : u(top), zIndex: 2 }}>
        {word && (
          <Pick id={c.leadGen ? c.kicker?.id : c.big?.id} sel={sel}>
            <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : t.styleId === 'minimal' ? 700 : 600, textTransform: 'uppercase', letterSpacing: t.styleId === 'modern_luxury' ? '0.04em' : t.styleId === 'bold' ? '0' : '-0.02em', fontSize: u(mastFs), lineHeight: 0.86, color: onPhoto.ink, whiteSpace: 'nowrap', textShadow: t.isDark ? '0 0.3cqmin 2cqmin rgba(0,0,0,0.25)' : undefined }}>{word}</div>
          </Pick>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `${hair} solid ${hexA(onPhoto.ink, 0.7)}`, marginTop: u(S.gap * 0.8), paddingTop: u(S.gap * 0.6), gap: u(S.gap) }}>
          <div style={{ fontFamily: t.fonts.label, fontWeight: c.leadGen ? 800 : 600, textTransform: 'uppercase', letterSpacing: c.leadGen ? '0.12em' : '0.2em', fontSize: u(c.leadGen ? fit(c.agent?.brokerage || c.agent?.name || '', S.kicker * 1.05, 22, 0.55) : S.kicker * 0.85), color: onPhoto.ink, whiteSpace: c.leadGen ? 'normal' : 'nowrap', overflow: c.leadGen ? 'visible' : 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{c.leadGen ? (c.agent?.brokerage || c.agent?.name || '') : placeName(c)}</div>
          {!c.leadGen && c.price && <PriceText c={c} t={t} ink={onPhoto} size={S.kicker * 1.05} sel={sel} font={t.fonts.label} showPrev={false} />}
        </div>
      </div>
      <div style={{ position: 'absolute', left: u(P), right: u(P), bottom, paddingBottom: portrait ? u(P * 0.6) : 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(S.gap * 1.1), zIndex: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.55), minWidth: 0, maxWidth: land ? '64%' : '100%' }}>
          {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={onPhoto} size={S.facts * 1.05} align="left" o={oh.o} /></Pick>}
          {c.title && (
            <Pick id={c.title.id} sel={sel}>
              <Title text={c.title.text} t={t} ink={onPhoto} size={S.title * (c.leadGen ? 0.8 : 0.96)} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={c.leadGen ? 24 : 15} />
              {!c.leadGen && c.sub && c.title.isAddress && <Sub text={c.sub.text} t={t} ink={onPhoto} size={S.sub * 1.02} align="left" style={{ marginTop: u(S.gap * 0.3) }} />}
            </Pick>
          )}
          {c.leadGen && c.sub && <Lede text={c.sub.text} t={t} ink={onPhoto} size={S.body} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
          {facts && (
            <Pick id={facts.id} sel={sel}>
              <div style={{ display: 'flex', gap: u(S.facts * 1.2), flexWrap: 'wrap' }}>
                {facts.items.map(i => (
                  <div key={i.key} style={{ borderLeft: `${u(0.5)} solid ${onPhoto.accent}`, paddingLeft: u(S.facts * 0.5) }}>
                    <div style={{ fontFamily: t.styleId === 'bold' ? t.fonts.display : t.fonts.label, fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: u(S.facts * 1.5), color: onPhoto.ink, lineHeight: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums' }}>{i.value}</div>
                    <div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: u(S.facts * 0.58), color: hexA(onPhoto.ink, 0.8), marginTop: u(S.facts * 0.32), whiteSpace: 'nowrap' }}>{i.label}</div>
                  </div>
                ))}
              </div>
            </Pick>
          )}
          <Details c={c} t={t} ink={onPhoto} S={S} align="left" sel={sel} only={['cta']} />
        </div>
        {!portrait && (c.agent || c.logo) && (
          <div style={{ borderTop: `${hair} solid ${hexA(onPhoto.ink, 0.45)}`, paddingTop: u(S.gap * 0.8) }}>
            <AgentBar c={c} t={t} ink={onPhoto} S={S} sel={sel} fam={fam} />
          </div>
        )}
      </div>
      {portrait && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${bandH}%`, background: T.light, padding: `${u(P * 0.6)} ${u(P)} ${u(P * 0.5)}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Footer c={c} t={t} ink={T.onLight} S={S} sel={sel} align="left" fam={fam} rule={false} />
        </div>
      )}
    </>
  )
}

// ── Mosaic: a hero plus supporting shots in a tight grid, the story told in a band beneath.
function Mosaic({ c, t, fam, S, sel }: CompProps) {
  if (fam === 'tall' || fam === 'banner') return <Collage c={c} t={t} fam={fam} S={S} sel={sel} />
  const T = tones(t)
  const P = S.pad
  const g = u(0.7)
  const photos = c.photos
  const side = photos.slice(1, 3)
  const bg = T.strong
  const ink = T.onStrong
  const grid = (style: CSSProperties, dir: 'row' | 'column') => (
    <div style={{ position: 'absolute', display: 'flex', flexDirection: dir, gap: g, ...style }}>
      <Photo photo={photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ flex: side.length ? 2 : 1 }} />
      {side.length > 0 && (
        <Pick id={c.galleryId} sel={sel} style={{ flex: 1, display: 'flex', flexDirection: dir === 'row' ? 'column' : 'row', gap: g }}>
          {side.map((p, i) => <Photo key={i} photo={p} t={t} sel={{}} style={{ flex: 1 }} />)}
        </Pick>
      )}
    </div>
  )
  const info = (k: number, stack: boolean) => (
    <div style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: stack ? 'flex-start' : 'flex-end', justifyContent: 'space-between', gap: u(S.gap * 1.2), width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5), minWidth: 0 }}>
        {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker * k} align="left" o={c.kicker.o} /></Pick>}
        {c.title && <Pick id={c.title.id} sel={sel}><Title text={c.title.text} t={t} ink={ink} size={S.title * 0.7 * k} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={20} /></Pick>}
        {c.sub && <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * k} align="left" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: stack ? 'flex-start' : 'flex-end', gap: u(S.gap * 0.5), flexShrink: 0 }}>
        <PriceText c={c} t={t} ink={ink} size={S.price * 0.6 * k} sel={sel} />
        <FactsLine c={c} t={t} ink={ink} size={S.facts * 0.9 * k} sel={sel} />
      </div>
    </div>
  )
  const oh = findOpenHouse(c)
  const ohRow = oh ? <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts} align="left" o={oh.o} /></Pick> : null

  if (fam === 'square') {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: bg }} />
        {grid({ left: 0, right: 0, top: 0, height: '64%' }, 'row')}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '64%', padding: `${u(P * 0.6)} ${u(P)} ${u(P * 0.55)}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap * 0.6) }}>
          {ohRow}
          {info(0.95, false)}
          <div style={{ borderTop: `${hair} solid ${ink.rule}`, paddingTop: u(S.gap * 0.6) }}><AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} /></div>
        </div>
      </>
    )
  }
  if (fam === 'story') {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: bg }} />
        <div style={{ position: 'absolute', left: u(P), right: u(P), top: '12%', height: '14%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: u(S.gap * 0.5) }}>
          {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker} align="left" o={c.kicker.o} /></Pick>}
          {c.title && <Pick id={c.title.id} sel={sel}><Title text={c.title.text} t={t} ink={ink} size={S.title * 0.72} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={18} /></Pick>}
          {c.sub && <Sub text={c.sub.text} t={t} ink={ink} size={S.sub} align="left" />}
        </div>
        {grid({ left: 0, right: 0, top: '27.5%', height: '46%' }, 'column')}
        <div style={{ position: 'absolute', left: u(P), right: u(P), top: '75.5%', bottom: '16%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap * 0.6) }}>
          {ohRow}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: u(S.gap * 1.4), flexWrap: 'wrap' }}>
            <PriceText c={c} t={t} ink={ink} size={S.price * 0.78} sel={sel} />
            <FactsLine c={c} t={t} ink={ink} size={S.facts * 1.05} sel={sel} />
          </div>
          <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
        </div>
      </>
    )
  }
  if (fam === 'landscape') {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: bg }} />
        {grid({ left: 0, top: 0, bottom: 0, width: '60%' }, 'row')}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', padding: `${u(P)} ${u(P)} ${u(P * 0.8)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap), justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
            {ohRow}
            {info(1.05, true)}
          </div>
          {c.isPrint ? <Footer c={c} t={t} ink={ink} S={scaled(S, 0.8)} sel={sel} align="left" fam={fam} narrow qrLabel={false} /> : <AgentCard c={c} t={t} ink={ink} S={S} sel={sel} scale={0.9} narrow />}
        </div>
      </>
    )
  }
  // Flyer: header, a hero with three supporting shots beneath, then the full listing story.
  const strip = photos.slice(1, 4)
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: T.light }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: bg, padding: `${u(P * 0.9)} ${u(P)} ${u(P * 0.8)}`, flexShrink: 0 }}>{info(1, false)}</div>
        <Photo photo={photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ flex: '0 0 42%' }} />
        {strip.length > 0 && (
          <Pick id={c.galleryId} sel={sel} style={{ flex: '0 0 13%', display: 'flex', gap: g, paddingTop: g, background: T.light }}>
            {strip.map((p, i) => <Photo key={i} photo={p} t={t} sel={{}} style={{ flex: 1 }} />)}
          </Pick>
        )}
        <div style={{ flex: 1, minHeight: 0, padding: `${u(P * 0.7)} ${u(P)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap) }}>
          {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={T.onLight} size={S.facts * 1.1} align="left" o={oh.o} /></Pick>}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}><Details c={c} t={t} ink={T.onLight} S={S} align="left" sel={sel} only={['description', 'highlights', 'cta']} clamp={4} /></div>
          <Footer c={c} t={t} ink={T.onLight} S={S} sel={sel} align="left" fam={fam} />
        </div>
      </div>
    </>
  )
}

// ── Seal: a round stamp - the news in the middle, the address running around the rim.
function SealBadge({ c, t, size, rotate = -10, sel }: { c: Content; t: DesignTheme; size: number; rotate?: number; sel: Sel }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const T = tones(t)
  const word = (c.big?.text || c.kicker?.text || '').trim()
  const words = word.split(/\s+/).filter(Boolean)
  const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words
  const longest = Math.max(...lines.map(l => l.length), 3)
  const charW = t.styleId === 'bold' ? 0.5 : t.styleId === 'modern_luxury' ? 0.78 : 0.64
  const fs = Math.min(21, 58 / longest / charW)
  const rimRaw = Array.from(new Set([c.title?.isAddress ? c.title.text : '', placeName(c)].filter(Boolean))).join('  •  ').toUpperCase() || 'OPENHOUSEPAL'
  // Repeat the address to go once around the rim, then let SVG space it to close the circle exactly.
  const unit = `${rimRaw}  •  `
  const rim = unit.repeat(Math.max(1, Math.floor(56 / unit.length)))
  // Rim circumference is ~245 units; size the type so the text closes the loop exactly.
  const rimFs = Math.min(7.4, Math.max(4.2, 243 / (rim.length * 0.8)))
  const bold = t.styleId === 'bold'
  const fill = bold ? T.onStrong.accent : `rgb(${deepTone(t)})`
  const text = bold ? T.strong : '#FFFFFF'
  const gold = bold ? T.strong : t.photoAccent
  return (
    <Pick id={c.big?.id || c.kicker?.id} sel={sel} style={{ width: u(size), height: u(size), transform: `rotate(${rotate}deg)`, filter: 'drop-shadow(0 0.8cqmin 2.4cqmin rgba(0,0,0,0.35))' }}>
      <svg viewBox="0 0 100 100" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
        <defs><path id={`rim${id}`} d="M50,50 m-39,0 a39,39 0 1,1 78,0 a39,39 0 1,1 -78,0" /></defs>
        <circle cx="50" cy="50" r="49" fill={fill} />
        <circle cx="50" cy="50" r="47" fill="none" stroke={gold} strokeWidth="0.9" />
        <circle cx="50" cy="50" r="45.2" fill="none" stroke={gold} strokeOpacity="0.45" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="32.2" fill="none" stroke={gold} strokeWidth="0.6" />
        <circle cx="50" cy="50" r="30.2" fill="none" stroke={gold} strokeOpacity="0.6" strokeWidth="0.5" strokeDasharray="0.5 1.4" />
        <text fill={gold} style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: rimFs, letterSpacing: rimFs * 0.18 }}>
          <textPath href={`#rim${id}`} startOffset="0">{rim}</textPath>
        </text>
        {lines.map((l, i) => (
          <text key={i} x="50" y={50 + (i - (lines.length - 1) / 2) * fs * 0.98 + fs * 0.34} textAnchor="middle" fill={text}
            style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: fs, textTransform: 'uppercase', letterSpacing: t.styleId === 'modern_luxury' ? '0.04em' : '0' }}>{l.toUpperCase()}</text>
        ))}
      </svg>
    </Pick>
  )
}

function Seal({ c, t, fam, S, sel }: CompProps) {
  if (socialFam(c, fam)) return <SealSocial c={c} t={t} fam={fam} S={S} sel={sel} />
  if (fam === 'tall' || fam === 'banner' || fam === 'portrait') return <Cinematic c={c} t={t} fam={fam} S={S} sel={sel} />
  const P = S.pad
  const onPhoto = inkDeep(t)
  const dk = deepTone(t)
  const story = fam === 'story'
  const land = fam === 'landscape'
  const oh = findOpenHouse(c)
  const sealSize = story ? 46 : land ? 40 : 34
  return (
    <StageWithBar c={c} t={t} fam={fam} S={S} sel={sel} tone="strong">
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: land ? scrimFor({ ...t, isDark: true, scrim: dk }, 'landscape', 0.95) : c.townOnly ? `linear-gradient(0deg, rgba(${dk},0.84) 0%, rgba(${dk},0.5) 22%, rgba(${dk},0) 46%)` : `linear-gradient(0deg, rgba(${dk},0.9) 0%, rgba(${dk},0.6) 30%, rgba(${dk},0) 62%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', zIndex: 3, ...(story ? { top: '14%', right: u(P * 0.8) } : land ? { top: u(P * 0.8), right: u(P * 0.9) } : { top: u(P * 0.7), right: u(P * 0.7) }) }}>
        <SealBadge c={c} t={t} size={sealSize} sel={sel} />
      </div>
      <div style={{ position: 'absolute', left: u(P), right: land ? '42%' : u(P), bottom: u(P * (c.townOnly ? 0.45 : 0.75)), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.7), zIndex: 2 }}>
        {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={onPhoto} size={S.facts * 1.05} align="left" o={oh.o} /></Pick>}
        {c.title && (
          <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.35) }}>
            <Title text={c.title.text} t={t} ink={onPhoto} size={S.title * 0.95} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={18} />
            {c.sub && <Sub text={c.sub.text} t={t} ink={onPhoto} size={S.sub * 1.05} align="left" />}
          </Pick>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.3), flexWrap: 'wrap' }}>
          <PriceText c={c} t={t} ink={onPhoto} size={S.price * 0.7} sel={sel} />
          <FactsLine c={c} t={t} ink={onPhoto} size={S.facts * 1.05} sel={sel} />
        </div>
      </div>
    </StageWithBar>
  )
}

// ---------------------------------------------------------------------------------------------
// Social-native trio (2026-10-08) - Keepsake, Billboard, Slant. Built for Instagram / Facebook
// posts and Stories (and the Facebook link size): each one keeps its identity across the square
// post, the 4:5 post, the Story and the wide post, so an agent can post a matching pair.
// ---------------------------------------------------------------------------------------------

// The situation's own word ("Just Sold", "Open House"), or a lead magnet's eyebrow / headline.
function newsWord(c: Content): string {
  return ((c.leadGen ? (c.kicker?.text || c.title?.text) : (c.big?.text || c.kicker?.text)) || '').trim()
}

// Up to `max` lines, words kept whole, balanced by length.
function splitLines(text: string, max = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return words
  let best: string[] = [text]
  for (let n = 2; n <= Math.min(max, words.length); n++) {
    const target = text.length / n
    const out: string[] = []
    let cur = ''
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w
      if (cur && next.length > target * 1.25 && out.length < n - 1) { out.push(cur); cur = w } else cur = next
    }
    out.push(cur)
    const longest = Math.max(...out.map(l => l.length))
    if (longest < Math.max(...best.map(l => l.length))) best = out
  }
  return best
}

// Price + facts as one ticker line ("SOLD FOR $3,420,000 ✦ 5 BD ✦ 4.5 BA ✦ 5,200 SF ✦ BRYN MAWR, PA").
function tickerItems(c: Content): string[] {
  const items: string[] = []
  if (c.leadGen) {
    const cta = c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined
    if (cta) items.push(cta.label)
    if (c.agent?.name && !c.isPrint) items.push(c.agent.name)
    if (c.agent?.phone) items.push(c.agent.phone)
    return items
  }
  // (the news word is already the giant headline above the band - user 10/10)
  if (c.price) items.push(`${c.price.label ? `${c.price.label} ` : ''}${c.price.value}`)
  const f = findFacts(c)
  for (const i of f?.items || []) items.push(`${i.value}${SHORT_FACT[i.label] !== '' ? ` ${SHORT_FACT[i.label] ?? i.label}` : ''}`)
  const place = placeName(c)
  if (place) items.push(place)
  return items
}

function ScriptLine({ text, size, color, align = 'left', id, sel, comfortable = 11, bold = 0, oneLineW }: { text: string; size: number; color: string; align?: 'left' | 'center'; id?: string; sel: Sel; comfortable?: number; bold?: number; oneLineW?: number }) {
  if (!text) return null
  // Too long for one line at a readable size ("Complimentary Home Valuation" on a door hanger):
  // two balanced lines, sized to the longer one - never cut off at the page edge.
  // oneLineW: always one line, as big as the given width allows (never bigger than `size`).
  const lines = !oneLineW && text.length > comfortable * 1.6 ? splitLines(text, 2) : [text]
  const longest = lines.reduce((a, l) => (l.length > a.length ? l : a), '')
  const fs = oneLineW ? Math.min(size, oneLineW / (Math.max(4, text.length) * 0.385)) : fit(longest, size, comfortable, lines.length > 1 ? 0.45 : 0.55)
  return (
    <Pick id={id} sel={sel}>
      <div style={{ fontFamily: DESIGN_FONTS.script, fontWeight: 400, fontSize: u(fs), lineHeight: lines.length > 1 ? 1.08 : 1, color, textAlign: align, paddingBottom: '0.08em', ...(bold ? { WebkitTextStroke: `${bold}em ${color}` } : {}) }}>
        {lines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}
      </div>
    </Pick>
  )
}

// ── Shared by the social-native layouts when they go to print: the sign-off with the QR code
// and the fine print (door hangers get the compact side-by-side contact block).
function PrintSignOff({ c, t, ink, S, sel, fam, align = 'left', qrLabel, big = 1, fineOneLine }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; fam: DesignFamily; align?: 'left' | 'center'; qrLabel?: boolean; big?: number; fineOneLine?: boolean }) {
  const wide = fam === 'landscape' || fam === 'banner'
  return <Footer c={c} t={t} ink={ink} S={S} sel={sel} align={align} fam={fam} narrow={wide} qrLabel={qrLabel ?? !wide} qrScale={(wide ? 1.05 : 1.2) * big} agentScale={big} fineOneLine={fineOneLine} />
}

// The listing story under the headline on flyers / mailers / door hangers.
function PrintStory({ c, t, ink, S, sel, align, clamp = 3 }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; align: 'left' | 'center'; clamp?: number }) {
  if (!c.isPrint) return null
  return <div style={{ width: '100%', overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['description', 'highlights']} clamp={clamp} /></div>
}

// Up to n photos for the multi-photo layouts - when the listing has fewer, the lead photo repeats
// with a different crop so a strip or fan never shows an empty frame.
function photosFor(c: Content, n: number): (PhotoRef | null)[] {
  const out: (PhotoRef | null)[] = []
  for (let i = 0; i < n; i++) {
    const p = c.photos[i]
    if (p) out.push(p)
    else if (c.photos[0]) out.push({ ...c.photos[0], x: [50, 22, 78, 35][i % 4], zoom: (c.photos[0].zoom || 1) * 1.35 })
    else out.push(null)
  }
  return out
}

// ── Keepsake: the home as an instant print, taped onto soft paper, a handwritten headline.
function InstantPrint({ c, t, sel, width, rotate, caption, photo, pickId, style, bold = 0, foot, footH = 0.22 }: { c: Content; t: DesignTheme; sel: Sel; width: number; rotate: number; caption: string; photo?: PhotoRef | null; pickId?: string; style?: CSSProperties; bold?: number; foot?: ReactNode; footH?: number }) {
  const captionId = c.leadGen ? (c.heroId || c.title?.id) : c.title?.id
  const tape = (side: 'left' | 'right') => (
    <span aria-hidden style={{
      position: 'absolute', top: u(-width * 0.045), [side]: '9%', width: '27%', height: u(width * 0.085),
      background: 'linear-gradient(180deg, rgba(240,230,205,0.9), rgba(226,214,186,0.86))',
      boxShadow: '0 0.25cqmin 0.6cqmin rgba(0,0,0,0.12)', transform: `rotate(${side === 'left' ? -9 : 8}deg)`, zIndex: 2,
      clipPath: 'polygon(2% 0, 98% 6%, 100% 94%, 0 100%)',
    } as CSSProperties} />
  )
  return (
    <div style={{ position: 'relative', width: u(width), flexShrink: 0, transform: `rotate(${rotate}deg)`, background: '#FFFDF8', padding: `${u(width * 0.05)} ${u(width * 0.05)} ${u(width * (foot ? footH : 0.22))}`, boxShadow: '0 1.8cqmin 4.2cqmin rgba(0,0,0,0.30), 0 0.3cqmin 0.8cqmin rgba(0,0,0,0.16)', borderRadius: u(0.35), ...style }}>
      {tape('left')}
      {tape('right')}
      <Photo photo={photo === undefined ? c.photos[0] : photo} t={t} sel={sel} pickId={pickId ?? (c.heroId || c.galleryId)} style={{ position: 'relative', width: '100%', aspectRatio: '1 / 0.92', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
      {foot && <div style={{ position: 'absolute', left: '7%', right: '7%', bottom: 0, height: u(width * footH), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{foot}</div>}
      {!foot && caption && (
        <Pick id={captionId} sel={sel} style={{ position: 'absolute', left: '6%', right: '6%', bottom: 0, height: u(width * 0.22), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* a long address writes on two lines (user 10/13: it was cut off with "...") - sized by the longer line */}
          {(() => {
            const capLines = caption.length > 26 ? splitLines(caption, 2) : [caption]
            const capLong = capLines.reduce((m, l) => (l.length > m.length ? l : m), '')
            return <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(fit(capLong, width * 0.105, capLines.length > 1 ? 16.5 : 20, capLines.length > 1 ? 0.5 : 0.6)), lineHeight: capLines.length > 1 ? 1.12 : 1.35, color: '#2B2824', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center', ...(bold ? { WebkitTextStroke: `${bold}em #2B2824` } : {}) }}>{capLines.map((l, i) => <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>)}</div>
          })()}
        </Pick>
      )}
    </div>
  )
}

// Three prints fanned like they were dropped on a table - the lead photo on top.
function PrintFan({ c, t, sel, width, caption, spread = 0, foot, footH }: { c: Content; t: DesignTheme; sel: Sel; width: number; caption: string; spread?: number; foot?: ReactNode; footH?: number }) {
  const [, b, d] = photosFor(c, 3)
  // spread > 0 fans the back prints further out and tips them more, so more of each shows
  const back = width * (0.78 + spread * 0.12)
  return (
    <div style={{ position: 'relative', width: u(width * (1.36 + spread)), height: u(width * (1.22 + spread * 0.1)), flexShrink: 0 }}>
      {c.photos.length > 1 && <InstantPrint c={c} t={t} sel={sel} width={back} rotate={-11 - spread * 6} caption="" photo={d} pickId={c.galleryId} style={{ position: 'absolute', left: u(width * spread * 0.07), top: u(width * (0.16 - spread * 0.12)) }} />}
      {c.photos.length > 1 && <InstantPrint c={c} t={t} sel={sel} width={back} rotate={9 + spread * 6} caption="" photo={b} pickId={c.galleryId} style={{ position: 'absolute', right: 0, top: u(width * (0.08 + spread * 0.1)) }} />}
      <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)' }}>
        <InstantPrint c={c} t={t} sel={sel} width={width} rotate={-2.5} caption={caption} foot={foot} footH={footH} />
      </div>
    </div>
  )
}

export function keepsakeCaption(situation: string | null | undefined): string {
  return situation === 'home_valuation' ? "Your home's worth" : situation === 'make_me_sell' ? 'Your next move' : situation === 'find_your_dream_home' ? 'Your next chapter' : situation === 'social_ad' ? 'Here whenever you are' : ''
}

function Keepsake({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  const story = fam === 'story'
  const tall = fam === 'tall'
  const portrait = fam === 'portrait'
  const wide = fam === 'landscape' || fam === 'banner'
  const S = wide ? scaled(S0, c.isPrint ? 0.8 : 0.86) : S0
  const P = S.pad
  const ink = inkOnBg(t)
  const paper = t.isDark ? t.bg : t.surface
  const word = newsWord(c)
  const script = t.isDark ? t.photoAccent : t.accent
  // a lead-gen print is captioned with a short line of its own, never the agent's name (user 10/12)
  const caption = c.leadGen ? (c.photoCaption ?? keepsakeCaption(c.situation)) : (c.title?.text || '')
  const facts = findFacts(c)
  const oh = findOpenHouse(c)
  const align: 'left' | 'center' = story || tall || portrait ? 'center' : 'left'
  const label = (text: string) => <div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: u(S.facts * 0.72), color: ink.muted, whiteSpace: 'nowrap' }}>{text}</div>
  const factsRow = story || wide || tall || portrait

  const info = (k: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.85 * k), alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align, minWidth: 0 }}>
      {c.leadGen ? (
        <>
          {c.title && <Pick id={c.title.id} sel={sel}><Title text={c.title.text} t={t} ink={ink} size={S.title * (portrait || tall ? 0.9 : 0.62) * k} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={portrait || tall ? 14 : 16} /></Pick>}
          {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
          <Details c={c} t={t} ink={ink} S={scaled(S, k)} align={align} sel={sel} only={['cta']} />
        </>
      ) : (
        <>
          {c.sub && !c.townOnly && label(placeName(c))}
          {c.price && (
            <Pick id={c.price.id} sel={sel}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: u(S.facts * 0.25) }}>
                {c.price.label && label(c.price.label)}
                <div style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(S.price * 0.92 * k * t.price.scale * c.price.o.k), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</div>
                {c.price.previous && <div style={{ fontFamily: t.fonts.label, fontSize: u(S.facts * 0.7), color: ink.muted, textDecoration: 'line-through' }}>{c.price.previous}</div>}
              </div>
            </Pick>
          )}
          {facts && (
            <Pick id={facts.id} sel={sel}>
              <div style={{ display: 'flex', flexDirection: factsRow ? 'row' : 'column', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: factsRow ? u(S.gap * 1.2) : u(S.gap * 0.45), alignItems: align === 'center' ? 'center' : 'flex-start' }}>
                {facts.items.map((i, n) => (
                  <div key={i.key} style={{ display: 'flex', alignItems: 'baseline', gap: u(S.facts * 0.35), paddingTop: !factsRow && n ? u(S.gap * 0.45) : 0, borderTop: !factsRow && n ? `${hair} solid ${ink.rule}` : undefined }}>
                    <span style={{ fontFamily: t.fonts.price, fontWeight: t.styleId === 'minimal' ? 600 : t.price.weight, fontSize: u(S.facts * 1.4 * k), color: ink.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
                    <span style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(S.facts * 0.62 * k), color: ink.muted, whiteSpace: 'nowrap' }}>{i.label}</span>
                  </div>
                ))}
              </div>
            </Pick>
          )}
          {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 0.95 * k} align={align} o={oh.o} /></Pick>}
        </>
      )}
    </div>
  )
  const signOff = c.isPrint
    ? <PrintSignOff c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} align={tall ? 'left' : 'left'} />
    : (c.agent || c.logo) && (
      <div style={{ width: '100%', borderTop: `${hair} solid ${ink.rule}`, paddingTop: u(S.gap * 0.8), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
        {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const backdrop = (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 70% at 12% 0%, ${hexA(script, 0.16)}, transparent 62%), radial-gradient(80% 60% at 100% 100%, ${hexA(script, 0.12)}, transparent 60%), repeating-linear-gradient(0deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 3px), ${paper}` }} />
  )
  const kickId = c.leadGen ? c.kicker?.id : (c.big?.id || c.kicker?.id)

  // Postcards (user 10/12): the words in a framed keepsake card (town + label in the gold, a diamond rule),
  // the QR in its own rounded box with the ask, and a slim footer with both numbers on one line
  // the gold sits on cream paper even in dark mode - a deeper shade keeps it readable there
  const deepen = (hex: string, k: number) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex; const n = parseInt(m[1], 16); const ch = (v: number) => Math.round(v * k).toString(16).padStart(2, '0'); return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}` }
  const gold = t.isDark ? deepen(script, 0.62) : script
  const askCta = c.leadGen ? (c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined) : undefined
  const ask = askCta?.label || (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo')
  const paperInk: Ink = { ...ink, ink: '#1B1A17', muted: '#6A655C', rule: 'rgba(27,26,23,0.16)', onPhoto: false }
  const caps: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.15 }
  const tapeStrip = (style: CSSProperties) => (
    <span aria-hidden style={{ position: 'absolute', width: u(13), height: u(3.4), background: 'linear-gradient(180deg, rgba(240,230,205,0.92), rgba(226,214,186,0.88))', boxShadow: '0 0.25cqmin 0.6cqmin rgba(0,0,0,0.12)', clipPath: 'polygon(2% 0, 98% 6%, 100% 94%, 0 100%)', zIndex: 2, ...style }} />
  )
  const paperNote = (rot: number, tape: CSSProperties, child: ReactNode, pad: string, fill = false) => (
    <div style={{ position: 'relative', transform: `rotate(${rot}deg)`, ...(fill ? { height: '100%' } : {}) }}>
      {tapeStrip(tape)}
      <div style={{ background: '#FFFDF8', borderRadius: u(0.4), boxShadow: '0 1cqmin 2.6cqmin rgba(0,0,0,0.2), 0 0 0 0.12cqmin rgba(0,0,0,0.04)', padding: pad, ...(fill ? { height: '100%', boxSizing: 'border-box' as const } : {}) }}>{child}</div>
    </div>
  )
  const diamondRule = (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.5) }}>
      <span style={{ flex: 1, height: hair, background: hexA(gold, 0.55) }} />
      <span style={{ width: u(1), height: u(1), background: gold, transform: 'rotate(45deg)' }} />
      <span style={{ flex: 1, height: hair, background: hexA(gold, 0.55) }} />
    </div>
  )
  const ohCards = !c.leadGen && !!oh
  const twine = '#A88E62'
  const ohPiecesAt = (sc: number, compact = false, wideW = 0) => {
    if (!ohCards || !oh) return null
    const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
    const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
    const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
    const rows = days.map((d, k) => {
      const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
      const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
      return { wd, mon: m ? m[1] : '', day: m ? m[2] : rest, time: times.length > 1 ? times[k] ?? '' : times[0] ?? '' }
    })
    const string = (left: string, h: number) => <span aria-hidden style={{ position: 'absolute', left, top: 0, width: u((0.4) * sc), height: u((h) * sc), background: twine, transform: 'translateX(-50%)', borderRadius: u((0.2) * sc) }} />
    if (rows.length === 1) {
      const r0 = rows[0]
      const W = wideW ? wideW / sc : 44
      return (
        <Pick id={oh.id} sel={sel} style={{ position: 'relative', paddingTop: u((4.5) * sc) }}>
          {string('16%', 5.2)}{string('84%', 5.2)}
          <div style={{ position: 'relative', width: u((W) * sc), background: '#FFFDF8', borderRadius: u((0.6) * sc), boxShadow: '0 1cqmin 2.4cqmin rgba(0,0,0,0.2)', padding: `${u((2.2) * sc)} ${u((2.4) * sc)} ${u((2) * sc)}`, textAlign: 'center', transform: 'rotate(1.2deg)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: u((0.9) * sc), border: `${u((0.3) * sc)} solid ${gold}`, borderRadius: u((0.4) * sc) }} />
            <div aria-hidden style={{ position: 'absolute', inset: u((1.6) * sc), border: `${hair} solid ${hexA(gold, 0.5)}`, borderRadius: u((0.3) * sc) }} />
            {['16%', '84%'].map(x => <span key={x} aria-hidden style={{ position: 'absolute', left: x, top: u((-0.4) * sc), width: u((1.4) * sc), height: u((1.4) * sc), borderRadius: '50%', background: '#FFFDF8', boxShadow: `0 0 0 ${u((0.3) * sc)} ${twine}`, transform: 'translateX(-50%)' }} />)}
            {r0.wd && <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u((4.4) * sc), lineHeight: 1.05, color: gold, WebkitTextStroke: `0.02em ${gold}` }}>{r0.wd}</div>}
            <div style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u((fit(`${r0.mon} ${r0.day}`, 5.4, 11, 0.6)) * sc), lineHeight: 1.1, color: '#1B1A17', whiteSpace: 'nowrap' }}>{r0.mon} {r0.day}</div>
            {r0.time && <div style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.12em', paddingLeft: '0.12em', fontSize: u((fit(r0.time, 3, 12, 0.6)) * sc), marginTop: u((0.8) * sc) }}>{r0.time}</div>}
          </div>
        </Pick>
      )
    }
    const W = wideW ? (wideW / sc - 3.2) / 2 : 21.5
    const tagClip = `polygon(${u((3) * sc)} 0, calc(100% - ${u((3) * sc)}) 0, 100% ${u((3) * sc)}, 100% 100%, 0 100%, 0 ${u((3) * sc)})`
    return (
      <Pick id={oh.id} sel={sel} style={{ display: 'flex', gap: u((3.2) * sc) }}>
        {rows.map((r0, k) => (
          <div key={k} style={{ position: 'relative', paddingTop: u((4.5) * sc), transform: `rotate(${k ? 2.5 : -2.5}deg)` }}>
            {string('50%', 6.4)}
            <div style={{ filter: 'drop-shadow(0 0.9cqmin 1.6cqmin rgba(0,0,0,0.2))' }}>
              <div style={{ width: u((W) * sc), background: gold, clipPath: tagClip, padding: u((0.35) * sc) }}>
                <div style={{ position: 'relative', background: '#FFFDF8', clipPath: tagClip, padding: `${u((3.4) * sc)} ${u((1) * sc)} ${u((1.6) * sc)}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span aria-hidden style={{ position: 'absolute', left: '50%', top: u((1) * sc), width: u((1.5) * sc), height: u((1.5) * sc), borderRadius: '50%', background: '#EFE6D2', boxShadow: `0 0 0 ${u((0.3) * sc)} ${gold}`, transform: 'translateX(-50%)' }} />
                  {r0.wd && <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u((fit(r0.wd, 3.6, 8, 0.6)) * sc), lineHeight: 1.1, color: gold, WebkitTextStroke: `0.02em ${gold}`, whiteSpace: 'nowrap' }}>{r0.wd}</div>}
                  {compact ? (() => {
                    const md = `${r0.mon.slice(0, 3)} ${r0.day}`.trim()
                    const split = (x: string) => x.length > 9 && x.includes('–') ? [x.slice(0, x.indexOf('–') + 1), x.slice(x.indexOf('–') + 1)] : x ? [x] : []
                    const tl = split(r0.time)
                    // one time size across both tags, so they match
                    const tlen = Math.max(4, ...rows.flatMap(rr => split(rr.time)).map(l => l.length))
                    return <>
                      <div style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u((Math.min(wideW ? 7 : 6, (W - 2.5) / (Math.max(4, md.length) * 0.58))) * sc), lineHeight: 1.05, color: '#1B1A17', whiteSpace: 'nowrap' }}>{md}</div>
                      {tl.length > 0 && <div style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.04em', fontSize: u((Math.min(wideW ? 4.6 : 4, (W - 2.5) / (tlen * 0.72))) * sc), lineHeight: 1.12, marginTop: u((0.8) * sc) }}>{tl.map((l, i) => <div key={i}>{l}</div>)}</div>}
                    </>
                  })() : <>
                  <div style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u((6.2) * sc), lineHeight: 1, color: '#1B1A17' }}>{r0.day}</div>
                  {r0.mon && <div style={{ ...caps, fontWeight: 800, color: '#1B1A17', letterSpacing: '0.16em', paddingLeft: '0.16em', fontSize: u((2.1) * sc) }}>{r0.mon.slice(0, 3)}</div>}
                  {r0.time && <div style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.04em', fontSize: u((fit(r0.time, 2.3, 12, 0.6)) * sc), marginTop: u((0.7) * sc), whiteSpace: 'normal', textWrap: 'balance' as any }}>{r0.time}</div>}
                  </>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Pick>
    )
  }
  if (wide && c.isPrint) {
    const ohPieces = ohPiecesAt(1)
    // Postcards (user 10/12): in the Keepsake's own language - the words on a taped photo-paper card
    // (the town handwritten like the print's caption), the QR on a taped note under it, a slim footer
    // with both numbers on one line
    const rightW = 150 - P * 2 - P * 0.3 - 60 - P * 1.1
    const qs = S.qr * 1.05
    const cardW = rightW - 2
    const priceW = facts ? cardW * 0.45 : cardW
    const statColW = facts ? (cardW - priceW - S.gap * 3) / facts.items.length : 0
    const statSize = facts ? Math.min(S.facts * 1.7, ...facts.items.map(i => (statColW - S.gap * 0.5) / (Math.max(2, i.value.length) * 0.47))) : 0
    const priceSize = c.price ? Math.min(S.price * 1.25 * t.price.scale, (priceW - S.gap * 2.6) / (c.price.value.length * 0.56)) * c.price.o.k : 0
    const town = !c.leadGen && c.sub && !c.townOnly ? placeName(c) : ''
    const leadFoot = c.leadGen && c.qr ? (
      <>
        {askCta && <Pick id={askCta.id} sel={sel} style={{ alignSelf: 'stretch' }}><FitLines text={askCta.label.replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())} size={S.facts * 1.85} lines={askCta.label.length > 26 ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} /></Pick>}
        {c.sub && <div style={{ marginTop: u(S.gap * 0.45), width: '100%' }}><Lede text={c.sub.text} t={t} ink={paperInk} size={S.body * 0.86} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35 }} /></div>}
      </>
    ) : null
    const leadCard = c.leadGen && c.qr ? (
      <div style={{ position: 'absolute', left: `calc(50% + ${u(P * 0.15)})`, bottom: u(-1), width: u(58), transform: 'translateX(-50%) rotate(1.5deg)', zIndex: 3 }}>
        {paperNote(0, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(-3deg)' }, (
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(1.4) }}>
            {c.title && (() => {
              const tt = titleCase(c.title!.text)
              const qm = tt.match(/^([\s\S]*?)([?.!]+)$/)
              return <Pick id={c.title!.id} sel={sel}><FitLines text={tt} node={qm ? <>{qm[1]}<span style={{ color: gold, fontStyle: 'italic' }}>{qm[2]}</span></> : tt} size={6.6 * (c.title!.o.k || 1)} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, lineHeight: 1.06, color: paperInk.ink, letterSpacing: '-0.005em', textWrap: 'balance' as any, opacity: c.title!.placeholder ? 0.45 : 1, ...c.title!.o.css }} /></Pick>
            })()}
            {diamondRule}
            {c.sub && <Lede text={c.sub.text} t={t} ink={paperInk} size={3.15} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.32, color: '#3A3631' }} />}
          </div>
        ), `${u(3)} ${u(3.2)} ${u(2.8)}`)}
      </div>
    ) : null
    const leadQr = c.leadGen && c.qr ? (
      <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ width: '100%' }}>
        {paperNote(-0.8, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(2deg)' }, (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.6), textAlign: 'center' }}>
            {askCta && <FitLines text={askCta.label.replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())} size={4.2} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} />}
            <div style={{ border: `${hair} solid ${hexA(gold, 0.45)}`, padding: u(1.1), background: '#FFFFFF' }}>
              <Qr c={c} t={t} ink={paperInk} size={26} sel={sel} labelSide="none" />
            </div>
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.16em', paddingLeft: '0.16em', fontSize: u(fit(c.qr.label, 3, 22, 0.6)) }}>{c.qr.label}</span></Pick>}
          </div>
        ), `${u(2.6)} ${u(3)} ${u(2.4)}`)}
      </Pick>
    ) : null
    const scanNudge = c.leadGen && c.qr ? (c.situation === 'home_valuation' ? "Scan to see what it's worth" : c.situation === 'make_me_sell' ? 'Scan & share your number' : c.situation === 'find_your_dream_home' ? 'Scan to start your search' : 'Scan the code') : ''
    const cardBody = c.leadGen ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.75) }}>
        {c.title && (() => {
          // one line when it fits, two balanced lines for a long question - as big as the card allows
          const tt = titleCase(c.title!.text)
          const qm = tt.match(/^([\s\S]*?)([?.!]+)$/)
          const long = tt.length > 26
          return <Pick id={c.title!.id} sel={sel}><FitLines text={tt} node={qm ? <>{qm[1]}<span style={{ color: gold, fontStyle: 'italic' }}>{qm[2]}</span></> : tt} size={S.title * 0.66 * (c.title!.o.k || 1)} lines={long ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.08, color: paperInk.ink, letterSpacing: '-0.005em', opacity: c.title!.placeholder ? 0.45 : 1, ...(long ? { textWrap: 'balance' as any } : {}), ...c.title!.o.css }} /></Pick>
        })()}
        {!c.qr && diamondRule}
        {!c.qr && c.sub && <Lede text={c.sub.text} t={t} ink={paperInk} size={S.body * 1.02} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
        {!c.qr && <Details c={c} t={t} ink={paperInk} S={S} align="left" sel={sel} only={['cta']} />}
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(S.gap * 0.7) }}>
        {town && <Pick id={c.title?.id} sel={sel}><div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(fit(town, S.facts * 2.45, 16, 0.6)), lineHeight: 1.05, color: gold, textAlign: 'center', whiteSpace: 'nowrap', WebkitTextStroke: `0.02em ${gold}` }}>{town}</div></Pick>}
        <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.1) }}>
          {c.price && (
            <Pick id={c.price.id} sel={sel} style={{ flex: facts ? '0 0 auto' : 1, width: facts ? u(priceW - S.gap * 2) : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.3) }}>
                {c.price.label && <span style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.22em', paddingLeft: '0.22em', fontSize: u(S.facts * 0.7) }}>{c.price.label}</span>}
                <span style={{ fontFamily: t.fonts.price, fontWeight: 600, letterSpacing: t.price.tracking, fontSize: u(priceSize), lineHeight: 1, color: paperInk.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
                {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.66), color: paperInk.muted, textDecoration: 'line-through', textDecorationColor: gold, whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
              </div>
            </Pick>
          )}
          {c.price && facts && (
            // the price/stats divider: a stronger gold line with a diamond (the stat dividers stay hairlines)
            <span aria-hidden style={{ alignSelf: 'stretch', position: 'relative', width: u(0.35), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: u(0.42), transform: 'translateX(-50%)', background: `linear-gradient(180deg, transparent, ${gold} 15%, ${gold} 85%, transparent)` }} />
              <span style={{ position: 'relative', width: u(2), height: u(2), background: gold, boxShadow: `0 0 0 ${u(0.45)} #FFFDF8`, transform: 'rotate(45deg)' }} />
            </span>
          )}
          {facts && (
            <Pick id={facts.id} sel={sel} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${facts.items.length}, 1fr)` }}>
                {facts.items.map((i, n) => (
                  <div key={i.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.25), borderLeft: n ? `${hair} solid ${hexA(gold, 0.3)}` : undefined, minWidth: 0 }}>
                    <span style={{ fontFamily: t.fonts.price, fontWeight: 600, fontSize: u(statSize), color: paperInk.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
                    <span style={{ ...caps, fontWeight: 800, letterSpacing: '0.12em', fontSize: u(S.facts * 0.6), color: gold }}>{i.label}</span>
                  </div>
                ))}
              </div>
            </Pick>
          )}
        </div>
        {false && oh && diamondRule}
        {false && oh && <Pick id={oh!.id} sel={sel}><OpenHouseLine date={oh!.date} time={oh!.time} t={t} ink={{ ...paperInk, accent: gold }} size={S.facts * 0.8} align="center" o={oh!.o} /></Pick>}
      </div>
    )
    const card = paperNote(1, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(-3deg)' }, cardBody, `${u(S.gap * 1.3)} ${u(S.gap * 1.5)} ${u(S.gap * 1.2)}`)
    const qrNote = c.qr && (
      <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ width: '100%', flexShrink: 0 }}>
        {paperNote(-0.8, { top: u(-1.4), left: u(-3), transform: 'rotate(-34deg)', width: u(10) }, (
          <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.4) }}>
            <div style={{ flexShrink: 0, border: `${hair} solid ${hexA(gold, 0.45)}`, padding: u(0.8), background: '#FFFFFF' }}>
              <Qr c={c} t={t} ink={paperInk} size={qs} sel={sel} labelSide="none" />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.4) }}>
              <FitLines text={(c.leadGen ? (c.qr.label || ask) : ask).replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())} size={S.facts * (c.leadGen ? 2.1 : 2)} lines={(c.leadGen ? (c.qr.label || ask) : ask).length > 24 ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.1, color: paperInk.ink, textWrap: 'balance' as any }} />
              {c.qr.label && !c.leadGen && <Pick id={c.qr.id} sel={sel}><span style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.16em', fontSize: u(fit(c.qr.label, S.facts * 1, 22, 0.6)) }}>{c.qr.label}</span></Pick>}
            </div>
          </div>
        ), `${u(S.gap * 0.85)} ${u(S.gap * 1.5)} ${u(S.gap * 0.85)} ${u(S.gap * 0.85)}`)}
      </Pick>
    )
    const footer = (c.agent || c.finePrint) && (
      <div data-foot="" style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6), width: '100%' }}>
        {c.agent && (
          <>
            <Rule color={ink.rule} />
            <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.2) }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><AgentCard fitLong c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={0.95} showContact={false} noTitle /></div>
              <div style={{ flexShrink: 0 }}><SplitContacts c={c} t={t} ink={ink} S={S} sel={sel} scale={0.68} /></div>
            </div>
          </>
        )}
        <FinePrint c={c} ink={ink} t={t} size={S.fine} oneLine />
      </div>
    )
    return (
      <>
        {backdrop}
        <div style={{ position: 'absolute', inset: 0, padding: u(P), display: 'flex', alignItems: 'center', gap: u(P * 1.1) }}>
          <div style={{ flexShrink: 0, paddingLeft: u(P * 0.3), position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', ...(leadCard ? { alignSelf: 'stretch', paddingTop: u(1.5) } : {}) }}>
            <InstantPrint c={c} t={t} sel={sel} width={ohCards ? 50 : 60} rotate={-3.5} caption={leadCard ? '' : caption} bold={0.018} />
            {leadCard}
            {ohPieces && <div style={{ position: 'relative', zIndex: 1, marginTop: u(-0.8) }}>{ohPieces}</div>}
            {/* listing news as a scrapbook sticker on the print's top-left corner (user 10/12) */}
            {!c.leadGen && word && <Pick id={kickId} sel={sel} style={{ position: 'absolute', top: u(-4), left: u(-3.5), zIndex: 3, transform: 'rotate(-10deg)' }}><KeepsakeSticker news={word} size={23} gold={gold} /></Pick>}
            {false && scanNudge && (
              <svg viewBox="0 0 40 43" fill="none" stroke={script} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: `calc(100% - ${u(6)})`, top: u(46), width: u(15), height: u(16), overflow: 'visible', zIndex: 3 }}>
                <path d="M2 38 C 18 40, 30 27, 37 9" />{/* (retired 10/12) */}
                <path d="M28.5 12 L 37.3 8.6 L 38.6 18" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap * 1.1) }}>
            <ScriptLine text={word} size={S.big * 0.98} color={script} id={kickId} sel={sel} comfortable={12} bold={0.022} />
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * (c.leadGen ? 1.25 : oh ? 1.05 : 1.6)), padding: `0 ${u(1)}` }}>
              {leadQr || card}
              {!leadQr && qrNote}
            </div>
            {footer}
          </div>
        </div>
      </>
    )
  }

  if (wide) {
    return (
      <>
        {backdrop}
        <div style={{ position: 'absolute', inset: 0, padding: u(P), display: 'flex', alignItems: 'center', gap: u(P * 1.1) }}>
          <div style={{ flexShrink: 0, paddingLeft: u(P * 0.3) }}><InstantPrint c={c} t={t} sel={sel} width={c.isPrint ? 60 : 66} rotate={-3.5} caption={caption} /></div>
          <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap) }}>
            <ScriptLine text={word} size={S.big * 0.95} color={script} id={kickId} sel={sel} comfortable={12} />
            {info(c.isPrint ? 1.25 : 1.3)}
            {signOff}
          </div>
        </div>
      </>
    )
  }

  // Letters / flyers (user 10/12): the approved postcard pieces, stood up - the fanned prints (with the
  // scrapbook sticker on listings), then the words on a taped paper card beside a taped QR note (the ask,
  // a big code, its message), and a footer without the QR
  if (portrait && c.isPrint) {
    const cw = 100 - P * 2
    const noteW = 32
    const cardW = cw - noteW - S.gap * 1.5
    const ohDays = ohCards && oh ? oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).length : 0
    const fanW = ohDays ? 37 : 39
    const priceW = cardW
    const statColW = facts ? (cardW - 5.2) / facts.items.length : 0
    const statSize = facts ? Math.min(S.facts * 1.9, ...facts.items.map(i => (statColW - S.gap * 0.5) / (Math.max(2, i.value.length) * 0.47))) : 0
    const priceSize = c.price ? Math.min(S.price * 1.3 * t.price.scale, (priceW - S.gap * 2.6) / (c.price.value.length * 0.56)) * c.price.o.k : 0
    const town = !c.leadGen && c.sub && !c.townOnly ? placeName(c) : ''
    const desc = c.details.find(d => d.kind === 'description') as Extract<DetailItem, { kind: 'description' }> | undefined
    const listingBody = (
      // open house (user 10/11): the card runs the full height of the QR + date column; every row evenly spaced, so the price sits centred between the town and its divider
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(S.gap * 0.65), ...(ohCards ? { height: '100%', justifyContent: 'space-between' } : {}) }}>
        {town && <Pick id={c.title?.id} sel={sel} style={ohCards ? { marginTop: u(1.4) } : undefined}><div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(ohCards ? fit(town, S.facts * 2.75, 15, 0.6) : fit(town, S.facts * 2.2, 18, 0.6)), lineHeight: 1.05, color: gold, textAlign: 'center', whiteSpace: 'nowrap', WebkitTextStroke: `0.02em ${gold}` }}>{town}</div></Pick>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(S.gap * 0.6), ...(ohCards ? { display: 'contents' } : {}) }}>
          {c.price && (
            <Pick id={c.price.id} sel={sel}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.3) }}>
                {c.price.label && <span style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.2em', paddingLeft: '0.2em', fontSize: u(S.facts * 0.68) }}>{c.price.label}</span>}
                <span style={{ fontFamily: t.fonts.price, fontWeight: 600, letterSpacing: t.price.tracking, fontSize: u(priceSize), lineHeight: 1, color: paperInk.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
                {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.66), color: paperInk.muted, textDecoration: 'line-through', textDecorationColor: gold, whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
              </div>
            </Pick>
          )}
          {c.price && facts && (
            // the price/stats divider: a stronger gold line with a diamond (the stat dividers stay hairlines)
            <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.5) }}>
              <span style={{ flex: 1, height: u(0.4), background: `linear-gradient(90deg, transparent, ${gold} 25%)` }} />
              <span style={{ width: u(1.7), height: u(1.7), background: gold, transform: 'rotate(45deg)' }} />
              <span style={{ flex: 1, height: u(0.4), background: `linear-gradient(270deg, transparent, ${gold} 25%)` }} />
            </div>
          )}
          {facts && (
            <Pick id={facts.id} sel={sel}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${facts.items.length}, 1fr)` }}>
                {facts.items.map((i, n) => (
                  <div key={i.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.25), borderLeft: n ? `${hair} solid ${hexA(gold, 0.3)}` : undefined, minWidth: 0 }}>
                    <span style={{ fontFamily: t.fonts.price, fontWeight: 600, fontSize: u(statSize), color: paperInk.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
                    <span style={{ ...caps, fontWeight: 800, letterSpacing: '0.1em', fontSize: u(S.facts * 0.66), color: gold }}>{i.label}</span>
                  </div>
                ))}
              </div>
            </Pick>
          )}
        </div>
        {desc && <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.65) }}><div style={{ height: hair, background: hexA(gold, 0.35) }} /><div style={{ overflow: 'hidden' }}><Details c={c} t={t} ink={paperInk} S={scaled(S, 1.1)} align="left" sel={sel} only={['description']} clamp={3} /></div></div>}
      </div>
    )
    const leadBody = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8) }}>
        {c.title && (() => {
          const tt = titleCase(c.title!.text)
          const qm = tt.match(/^([\s\S]*?)([?.!]+)$/)
          return <Pick id={c.title!.id} sel={sel}><FitLines text={tt} node={qm ? <>{qm[1]}<span style={{ color: gold, fontStyle: 'italic' }}>{qm[2]}</span></> : tt} size={5.4 * (c.title!.o.k || 1)} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, lineHeight: 1.06, color: paperInk.ink, letterSpacing: '-0.005em', textWrap: 'balance' as any, opacity: c.title!.placeholder ? 0.45 : 1, ...c.title!.o.css }} /></Pick>
        })()}
        {diamondRule}
        {c.sub && <Lede text={c.sub.text} t={t} ink={paperInk} size={2.45} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35, color: '#3A3631' }} />}
      </div>
    )
    const qrNote = c.qr && (
      <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ width: u(noteW), flexShrink: 0 }}>
        {paperNote(-1.2, { top: u(-1.5), left: '50%', marginLeft: u(-6.5), transform: 'rotate(3deg)' }, (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.6), textAlign: 'center' }}>
            {!c.leadGen && <FitLines text={ask.replace(/(^|\s)(\S)/g, (_m, a, ch) => a + ch.toUpperCase())} size={3.2} lines={ask.length <= 18 ? 1 : 2} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} />}
            <div style={{ border: `${hair} solid ${hexA(gold, 0.45)}`, padding: u(0.8), background: '#FFFFFF' }}>
              <Qr c={c} t={t} ink={paperInk} size={18} sel={sel} labelSide="none" />
            </div>
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.12em', paddingLeft: '0.12em', fontSize: u(fit(c.qr.label, 1.9, 18, 0.6)) }}>{c.qr.label}</span></Pick>}
          </div>
        ), `${u(2.2)} ${u(2)} ${u(2)}`)}
      </Pick>
    )
    const card = paperNote(0.8, { top: u(-1.5), left: '50%', marginLeft: u(-6.5), transform: 'rotate(-3deg)' }, c.leadGen ? leadBody : listingBody, `${u(2.6)} ${u(2.6)} ${u(2.3)}`, ohCards)
    const fanBox = fanW * (1.36 + 0.55)
    const leadAsk = c.leadGen && c.qr && askCta ? (
      <Pick id={askCta.id} sel={sel} style={{ alignSelf: 'stretch' }}><FitLines text={askCta.label.replace(/(^|\s)(\S)/g, (_m, a, ch) => a + ch.toUpperCase())} size={askCta.label.length <= 20 ? 5.6 : 4.4} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} /></Pick>
    ) : null
    return (
      <>
        {backdrop}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(P * 0.85)} ${u(P)} ${u(P * 0.7)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.9) }}>
          {/* the heading sits above the prints, so a tail like the g in Coming is never hidden */}
          <div style={{ position: 'relative', zIndex: 7, width: '100%' }}><ScriptLine text={word} size={S.big * 1.08} color={script} align="center" id={kickId} sel={sel} comfortable={16} bold={0.022} /></div>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <PrintFan c={c} t={t} sel={sel} width={fanW} caption={caption} spread={0.55} foot={leadAsk || undefined} footH={0.36} />
              {leadAsk && (
                // a hand-drawn arrow from the words on the print down to the QR note
                <svg viewBox="0 0 40 46" fill="none" stroke={script} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: `calc(50% + ${u(fanW * 0.5 + 2.2)})`, top: u(fanW * 1.1), width: u(10.5), height: u(12), overflow: 'visible', zIndex: 6 }}>
                  <path d="M2 6 C 9 2, 15 3, 16 8 C 17 13, 10 14, 10.5 9.5 C 11 5, 20 3.5, 26 8 C 31 12, 33 22, 32 39" />
                  <path d="M26.5 32.5 C 28.5 35, 30.5 37.5, 32 40 C 33.5 37, 35.5 34.5, 37.5 32.5" />
                </svg>
              )}
              {!c.leadGen && word && <Pick id={kickId} sel={sel} style={{ position: 'absolute', top: u(-2.2), left: u(-4.2), zIndex: 3, transform: 'rotate(-14deg)' }}><KeepsakeSticker news={word} size={17} gold={gold} /></Pick>}
            </div>
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: ohCards ? 'flex-start' : 'center', gap: u(S.gap * 1.5), padding: `0 ${u(0.5)}`, boxSizing: 'border-box' }}>
            <div style={{ flex: 1, minWidth: 0, alignSelf: ohCards ? 'stretch' : undefined }}>{card}</div>
            {ohCards ? (
              // open house (user 10/11): the QR note up level with the address card, the date sign hanging under it
              <div style={{ width: u(noteW), flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {qrNote}
                <div style={{ position: 'relative', zIndex: 1, marginTop: u(-1.2) }}>{ohPiecesAt(ohDays > 1 ? 0.63 : 0.7, true)}</div>
              </div>
            ) : qrNote}
          </div>
          <div style={{ width: '100%', marginTop: u(S.gap * 0.4) }}><PrintSignOff c={{ ...c, qr: null }} t={t} ink={ink} S={S} sel={sel} fam={fam} /></div>
        </div>
      </>
    )
  }

  // Flyer / letter mailer (non-print fallback): the headline, three prints fanned, the facts, the story.
  if (portrait) {
    return (
      <>
        {backdrop}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(tall ? HANGER_ZONE + 2 : P * 0.85)} ${u(P)} ${u(P * 0.7)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * (tall ? 1.2 : 0.8)) }}>
          <ScriptLine text={word} size={S.big * (tall ? 1.05 : 1)} color={script} align="center" id={kickId} sel={sel} comfortable={tall ? 9 : 12} />
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PrintFan c={c} t={t} sel={sel} width={tall ? 62 : 46} caption={caption} />
          </div>
          {info(tall ? 1.05 : 1.05)}
          {!c.leadGen && <div style={{ width: tall ? '100%' : '86%' }}><PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="center" clamp={tall ? 4 : 2} /></div>}
          <div style={{ width: '100%' }}>{signOff}</div>
        </div>
      </>
    )
  }

  // Social posts (user 10/12): the approved print pieces on the feed - the print with its one-word sticker,
  // the words on a taped paper card (town, price, gold diamond divider, stats), the open-house date hanging
  // beside / under it, and lead-gen = a headline card over the photo plus a taped note with the ask
  const sTown = !c.leadGen && c.sub && !c.townOnly ? placeName(c) : ''
  const socialCard = (innerW: number, cols0: number, k: number, withDesc = false, descLines = 3, townTop = 0) => {
    const items = facts?.items || []
    const cols = items.length <= 3 ? Math.max(1, items.length) : cols0
    const colW = innerW / Math.max(1, Math.min(cols, items.length || 1))
    const priceSize = c.price ? Math.min(S.price * 1.5 * k * t.price.scale, (innerW - 1) / (c.price.value.length * 0.56)) * c.price.o.k : 0
    const statSize = facts ? Math.min(S.facts * 2 * k, ...items.map(i => (colW - 1.6) / (Math.max(2, i.value.length) * 0.5))) : 0
    return <div style={{ width: '100%', minWidth: 0 }}>{paperNote(1, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(-3deg)' }, (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(S.gap * 0.7 * k) }}>
        {sTown && <Pick id={c.title?.id} sel={sel} style={townTop ? { marginTop: u(townTop) } : undefined}><div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(Math.min(fit(sTown, S.facts * 2.5 * k, 14, 0.6), (innerW - 1) / (sTown.length * 0.46))), lineHeight: 1.05, color: gold, textAlign: 'center', whiteSpace: 'nowrap', WebkitTextStroke: `0.02em ${gold}` }}>{sTown}</div></Pick>}
        {c.price && (
          <Pick id={c.price.id} sel={sel}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.3 * k) }}>
              {c.price.label && <span style={{ ...caps, fontWeight: 800, color: gold, letterSpacing: '0.2em', paddingLeft: '0.2em', fontSize: u(S.facts * 0.68 * k) }}>{c.price.label}</span>}
              <span style={{ fontFamily: t.fonts.price, fontWeight: 600, letterSpacing: t.price.tracking, fontSize: u(priceSize), lineHeight: 1, color: paperInk.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
              {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.66 * k), color: paperInk.muted, textDecoration: 'line-through', textDecorationColor: gold, whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
            </div>
          </Pick>
        )}
        {c.price && facts && (
          <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.5) }}>
            <span style={{ flex: 1, height: u(0.4), background: `linear-gradient(90deg, transparent, ${gold} 25%)` }} />
            <span style={{ width: u(1.7), height: u(1.7), background: gold, transform: 'rotate(45deg)' }} />
            <span style={{ flex: 1, height: u(0.4), background: `linear-gradient(270deg, transparent, ${gold} 25%)` }} />
          </div>
        )}
        {facts && (
          <Pick id={facts.id} sel={sel}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols, items.length)}, 1fr)` }}>
              {items.map((i, n) => (
                <div key={i.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.25 * k), padding: `${u(cols < items.length ? 1.1 : 0)} 0`, borderLeft: n % cols ? `${hair} solid ${hexA(gold, 0.3)}` : undefined, borderTop: n >= cols ? `${hair} solid ${hexA(gold, 0.3)}` : undefined, minWidth: 0 }}>
                  <span style={{ fontFamily: t.fonts.price, fontWeight: 600, fontSize: u(statSize), color: paperInk.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
                  <span style={{ ...caps, fontWeight: 800, letterSpacing: '0.1em', fontSize: u(S.facts * 0.62 * k), color: gold }}>{i.label}</span>
                </div>
              ))}
            </div>
          </Pick>
        )}
        {withDesc && c.details.some(d => d.kind === 'description') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6 * k) }}>
            <div style={{ height: hair, background: hexA(gold, 0.35) }} />
            <div style={{ overflow: 'hidden' }}><Details c={c} t={t} ink={paperInk} S={scaled(S, k * 0.92)} align="center" sel={sel} only={['description']} clamp={descLines} /></div>
          </div>
        )}
      </div>
    ), `${u(2.4)} ${u(2.4)} ${u(2.2)}`)}</div>
  }
  const leadTitle = (size: number) => {
    if (!c.title) return null
    const tt = titleCase(c.title.text)
    const qm = tt.match(/^([\s\S]*?)([?.!]+)$/)
    return <Pick id={c.title.id} sel={sel}><FitLines text={tt} node={qm ? <>{qm[1]}<span style={{ color: gold, fontStyle: 'italic' }}>{qm[2]}</span></> : tt} size={size * (c.title.o.k || 1)} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, lineHeight: 1.06, color: paperInk.ink, letterSpacing: '-0.005em', textWrap: 'balance' as any, opacity: c.title.placeholder ? 0.45 : 1, ...c.title.o.css }} /></Pick>
  }
  // the headline card laid over the bottom of the lead print
  const socialLeadCard = (w: number, titleSize: number, sub: boolean) => (
    <div style={{ position: 'absolute', left: '50%', bottom: u(-2), width: u(w), transform: 'translateX(-50%) rotate(1.5deg)', zIndex: 3 }}>
      {paperNote(0, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(-3deg)' }, (
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(1.3), textAlign: 'center' }}>
          {leadTitle(titleSize)}
          {diamondRule}
          {sub && c.sub && <Lede text={c.sub.text} t={t} ink={paperInk} size={titleSize * 0.46} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.32, color: '#3A3631' }} />}
        </div>
      ), `${u(2.6)} ${u(2.8)} ${u(2.4)}`)}
    </div>
  )
  // the ask on its own taped note, in the readable serif (never a solid button on Keepsake)
  const askNote = (askSize: number, sub: boolean) => askCta && (
    <Pick id={askCta.id} sel={sel} style={{ width: '100%' }}>
      {paperNote(-1, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(2.5deg)' }, (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.4), textAlign: 'center' }}>
          <FitLines text={askCta.label.replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())} size={askSize} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} />
          {sub && c.sub && <>{diamondRule}<div style={{ width: '100%' }}><Lede text={c.sub.text} t={t} ink={paperInk} size={askSize * 0.56} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.34, color: '#3A3631' }} /></div></>}
        </div>
      ), `${u(2.6)} ${u(2.6)} ${u(2.4)}`)}
    </Pick>
  )
  const sticker = (size: number, top: number, left: number) => !c.leadGen && word ? <Pick id={kickId} sel={sel} style={{ position: 'absolute', top: u(top), left: u(left), zIndex: 3, transform: 'rotate(-10deg)' }}><KeepsakeSticker news={word} size={size} gold={gold} /></Pick> : null
  const sDays = ohCards && oh ? oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).length : 0
  const header = (size: number, center: boolean, comfortable: number, oneLineW?: number) => (
    // the heading sits above the prints, so a tail like the g in Coming is never hidden
    <div style={{ position: 'relative', zIndex: 7, width: '100%' }}><ScriptLine text={word} size={size} color={script} align={center ? 'center' : 'left'} id={kickId} sel={sel} comfortable={comfortable} bold={0.022} oneLineW={oneLineW} /></div>
  )

  // Door hanger (user 10/12): the approved Keepsake pieces, stood up under the hanger hole - the fanned
  // prints with the one-word sticker, the taped card (town, price, gold divider, stats, description) with the
  // open-house date hanging from it, a taped QR note; lead-gen = the ask on the lead print + a headline card
  if (tall) {
    const caps1 = (x: string) => x.replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())
    const fanW = c.leadGen ? 44 : ohCards ? 33 : 35
    // heading + prints a little lower, off the hanger hole (user 10/12): a one-line lead headline gets more
    const dropT = ohCards ? 4 : c.leadGen ? (word.length > 16 ? 3 : 9) : 3
    const leadAskT = c.leadGen && askCta ? (
      <Pick id={askCta.id} sel={sel} style={{ alignSelf: 'stretch' }}><FitLines text={caps1(askCta.label)} size={askCta.label.length <= 20 ? 6.6 : 5.2} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} /></Pick>
    ) : null
    const leadCardT = c.leadGen && paperNote(0.8, { top: u(-1.6), left: '50%', marginLeft: u(-6.5), transform: 'rotate(-3deg)' }, (
      <div style={{ display: 'flex', flexDirection: 'column', gap: u(1.6), textAlign: 'center' }}>
        {leadTitle(7.2)}
        {diamondRule}
        {c.sub && <Lede text={c.sub.text} t={t} ink={paperInk} size={3.4} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.34, color: '#3A3631' }} />}
      </div>
    ), `${u(3.2)} ${u(3.2)} ${u(3)}`)
    const qrNoteT = c.qr && (
      <Pick id={c.leadGen ? c.qr.id : askCta?.id || c.qr.id} sel={sel} style={{ width: '100%' }}>
        {paperNote(-0.8, { top: u(-1.4), left: u(-3), transform: 'rotate(-34deg)', width: u(12) }, (
          <div style={{ display: 'flex', alignItems: 'center', gap: u(3) }}>
            <div style={{ flexShrink: 0, border: `${hair} solid ${hexA(gold, 0.45)}`, padding: u(1), background: '#FFFFFF' }}>
              <Qr c={c} t={t} ink={paperInk} size={22} sel={sel} labelSide="none" />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(1.4) }}>
              <FitLines text={caps1(c.leadGen ? 'Learn more' : ask)} size={5.4} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: paperInk.ink, textWrap: 'balance' as any }} />
              {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...caps, display: 'block', fontWeight: 800, color: gold, letterSpacing: c.qr.label.length > 16 ? '0.06em' : '0.12em', lineHeight: 1.3, whiteSpace: 'nowrap', fontSize: u(Math.min(3.8, (100 - P * 2 - 34) / (c.qr.label.length * (c.qr.label.length > 16 ? 0.66 : 0.72)))) }}>{c.qr.label}</span></Pick>}
            </div>
          </div>
        ), `${u(2.2)} ${u(3)} ${u(2.2)} ${u(2.2)}`)}
      </Pick>
    )
    return (
      <>
        {backdrop}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(HANGER_ZONE - 2 + dropT)} ${u(P)} ${u(P * 0.75)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.9) }}>
          {/* the headline under the die-cut hole, above the prints */}
          <div style={{ position: 'relative', zIndex: 7, width: '100%' }}><ScriptLine text={word} size={S.big * 1.08} color={script} align="center" id={kickId} sel={sel} comfortable={9} bold={0.022} /></div>
          <div style={{ flexShrink: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <PrintFan c={c} t={t} sel={sel} width={fanW} caption={caption} spread={0.4} foot={leadAskT || undefined} footH={0.36} />
              {sticker(24, -3, -5)}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', gap: u(S.gap * 1.2) }}>
            {c.leadGen ? <div style={{ width: '100%' }}>{leadCardT}</div> : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {socialCard(100 - P * 2 - 5, 4, 1, !ohCards, 3, 1.4)}
                {ohCards && <div style={{ position: 'relative', zIndex: 1, marginTop: u(-1.4) }}>{ohPiecesAt(sDays > 1 ? 0.9 : 0.95, true, 100 - P * 2 - 12)}</div>}
              </div>
            )}
            {qrNoteT}
          </div>
          {(c.agent || c.finePrint) && (
            <div data-foot="" style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.55) }}>
              {c.agent && (
                <>
                  <Rule color={ink.rule} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap) }}>
                    <div style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}><AgentCard c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={0.9} showContact={false} noTitle /></div>
                    {(() => {
                      // narrow hanger: mobile, office and email stacked on the right, one per line
                      const a = c.agent!
                      const mail = a.email || a.website || ''
                      const base: CSSProperties = { fontFamily: t.fonts.label, color: ink.ink, whiteSpace: 'nowrap', lineHeight: 1.25, fontVariantNumeric: 'lining-nums' }
                      return (
                        <Pick id={a.id} sel={sel} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', gap: u(0.5) }}>
                          {a.phone && <Tel kind="mobile" num={a.phone} style={{ ...base, fontWeight: 700, fontSize: u(3.2) }} />}
                          {a.office && <Tel kind="office" num={a.office} style={{ ...base, fontWeight: 500, fontSize: u(2.9) }} />}
                          {mail && <div style={{ ...base, fontWeight: 600, fontSize: u(Math.min(2.8, 40 / (mail.length * 0.55))) }}>{mail}</div>}
                        </Pick>
                      )
                    })()}
                  </div>
                </>
              )}
              <FinePrint c={c} ink={ink} t={t} size={S.fine} oneLine />
            </div>
          )}
        </div>
      </>
    )
  }

  if (story) {
    const W = c.leadGen ? 66 : ohCards ? (sDays > 1 ? 42 : 46) : 54
    const ohRow = ohCards && !c.leadGen
    return (
      <>
        {backdrop}
        <div style={{ position: 'absolute', inset: 0, padding: `10cqh ${u(P)} 11cqh`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
          {header(S.big * 1.05, true, 12)}
          {/* the print and its card sit right under the header (user 10/12); the spare room goes above the sign-off */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: u(-1) }}>
            <div style={{ position: 'relative', ...(c.leadGen ? { marginBottom: u(10) } : {}) }}>
              <InstantPrint c={c} t={t} sel={sel} width={W * (word.length > 10 ? 0.9 : 1)} rotate={-2.5} caption={c.leadGen ? '' : caption} bold={0.018} />
              {c.leadGen && socialLeadCard(W + 10, 6.4, true)}
              {sticker(21, -4, -4)}
            </div>
          </div>
          {c.leadGen
            ? <div style={{ width: '74%', marginTop: u(4) }}>{askNote(5.4, false)}</div>
            : ohRow
              ? (
                // open house: the date sign / tags hang from the bottom of the card (user 10/12)
                <div style={{ width: '84%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {socialCard((100 - P * 2) * 0.84 - 5, 4, 0.95)}
                  <div style={{ position: 'relative', zIndex: 1, marginTop: u(-1.4) }}>{ohPiecesAt(sDays > 1 ? 0.72 : 0.76, true)}</div>
                </div>
              )
              : <div style={{ width: '84%' }}>{socialCard((100 - P * 2) * 0.84 - 5, 4, 0.95)}</div>}
          <div style={{ flex: 1, minHeight: 0 }} />
          <div style={{ width: '100%' }}>{signOff}</div>
        </div>
      </>
    )
  }

  // Square + 4:5 post: the headline across the top, the print (with its sticker) beside the taped card.
  const W = (ar < 0.9 ? 49 : 50) * (word.length > 11 ? 0.86 : 1)
  const colW = 100 - P * 2.8 - W
  return (
    <>
      {backdrop}
      <div style={{ position: 'absolute', inset: 0, padding: `${u(P * (ar < 0.9 ? 1.35 : 0.85))} ${u(P)} ${u(P * 0.75)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8) }}>
        {header(S.big * 1.08, true, 11, 100 - P * 2.2)}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: u(P * 0.8) }}>
          <div style={{ position: 'relative', flexShrink: 0, paddingLeft: u(P * 0.2), ...(c.leadGen ? { marginBottom: u(6) } : {}) }}>
            <InstantPrint c={c} t={t} sel={sel} width={W} rotate={-3.5} caption={c.leadGen ? '' : caption} bold={0.018} />
            {c.leadGen && socialLeadCard(W + 6, 5.2, false)}
            {sticker(19, -4, -3)}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {c.leadGen ? askNote(3.9, true) : socialCard(colW - 5, 2, 1.3)}
            {!c.leadGen && ohCards && <div style={{ position: 'relative', zIndex: 1, marginTop: u(-1.2) }}>{ohPiecesAt(sDays > 1 ? 0.66 : 0.66, true)}</div>}
          </div>
        </div>
        {signOff}
      </div>
    </>
  )
}

// ── Billboard: the news in giant poster type, the photo as a card laid over it, a ticker of the
// facts running across - loud, graphic, unmistakable in a feed or a mailbox.
function Billboard({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  const hanger = fam === 'tall' && c.isPrint
  const story = fam === 'story' || hanger
  const tall = fam === 'tall' && !hanger
  const portrait = fam === 'portrait'
  const wide = fam === 'landscape' || fam === 'banner'
  const S = wide ? scaled(S0, c.isPrint ? 0.8 : 0.86) : S0
  const P = S.pad
  const T = tones(t)
  const ink = T.onStrong
  const word = (c.leadGen ? (c.title?.text || newsWord(c)) : newsWord(c)).toUpperCase()
  const hangerAsk = tall && c.leadGen
  // Door-hanger ask: three lines, two words each where it can ("WHAT IS / YOUR HOME / WORTH?").
  const social = (!c.isPrint && (fam === 'square' || story)) || hanger
  const newLook = ((wide || portrait) && c.isPrint) || social
  const tallLook = (portrait && c.isPrint) || social
  const ohSide = social && !c.leadGen && !!findOpenHouse(c)
  const oneLineGiant = portrait && c.isPrint && !c.leadGen
  const bigStack = social && !c.leadGen && !oneLineGiant && !ohSide
  const lines = oneLineGiant ? [word] : ohSide || (social && story && !c.leadGen) ? splitLines(word, 2) : splitLines(word, hangerAsk ? 3 : word.length > 18 ? (word.length > 30 ? 4 : 3) : 2)
  const charW = t.styleId === 'bold' ? 0.48 : t.styleId === 'modern_luxury' ? 0.84 : t.styleId === 'minimal' ? 0.72 : 0.68
  const usable = fam === 'banner' ? 300 * 0.28 : wide ? 150 * 0.44 : 100 - P * 2
  const longest = Math.max(3, ...lines.map(l => l.length))
  const twoDaysB = /&| and /i.test(findOpenHouse(c)?.date || '')
  const fs = ohSide ? (c.socialButton ? 0.84 : 1) * Math.min(story ? (twoDaysB ? 26 : 24) : 21, ((100 - P * 2) - (story ? (twoDaysB ? 20 : 23 * 1.4) : twoDaysB ? 2 * 17.5 * (ar < 0.9 ? 1.08 : 1) + 2.4 : 23 * 1.3) - 3) / longest / (charW * 0.86)) : oneLineGiant || bigStack ? Math.min(bigStack ? (!story && ar < 0.9 ? (c.socialButton ? 11.5 : 14) : c.socialButton ? (story ? 19 : longest <= 6 && ar >= 0.9 ? 14 : 15.5) : !story && longest <= 6 ? 18 : hanger ? 17.5 : story && longest <= 5 ? 22 : 26) : 24, usable / longest / (charW * (bigStack ? 0.9 : story ? 0.62 : 0.74))) : Math.min(story || tall ? 34 : wide ? (c.isPrint && fam !== 'banner' ? (c.leadGen ? 14 : 14.5) : 22) : portrait && c.isPrint ? 15.5 : social ? (story ? 19 : ar < 0.9 ? 15 : 12.5) : 26, usable / longest / (hangerAsk ? charW * 0.8 : charW))
  const lead = 0.84
  const outline = ink.accent
  const giant = (
    <Pick id={c.leadGen ? c.title?.id || c.kicker?.id : c.big?.id || c.kicker?.id} sel={sel} style={{ position: 'relative', zIndex: 1 }}>
      {c.leadGen && c.kicker && <div style={{ marginBottom: u(fs * 0.12) }}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker} align="left" o={c.kicker.o} /></div>}
      {lines.map((l, i) => (
        <div key={i} style={{
          ...(bigStack ? { textAlign: 'center' as const } : {}),
          fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : t.styleId === 'minimal' ? 800 : 600,
          textTransform: 'uppercase', letterSpacing: t.styleId === 'modern_luxury' ? '0.02em' : '-0.015em',
          fontSize: u(fs), lineHeight: lead, whiteSpace: 'nowrap',
          ...(i % 2 === 1 ? (c.leadGen ? { color: outline } : { color: 'transparent', WebkitTextStroke: `max(1px, ${Math.max(0.18, fs * 0.012)}cqmin) ${outline}` }) : { color: ink.ink }),
        } as CSSProperties}>{oneLineGiant ? l.split(' ').map((w, k) => <span key={k} style={k > 0 ? { color: 'transparent', WebkitTextStroke: `max(1px, ${Math.max(0.18, fs * 0.012)}cqmin) ${outline}` } : undefined}>{k > 0 ? ' ' : ''}{w}</span>) : l}</div>
      ))}
    </Pick>
  )
  const giantH = lines.length * fs * lead + (c.leadGen && c.kicker ? S.kicker * 2 : 0)
  const items = tickerItems(c)
  const ticker = items.length > 0 && (
    <Pick id={c.price?.id || findFacts(c)?.id} sel={sel} style={{ position: 'relative', zIndex: 3, margin: `0 ${u(-P * 1.5)}`, transform: 'rotate(-1.6deg)', background: ink.fill, boxShadow: '0 0.8cqmin 2cqmin rgba(0,0,0,0.25)', overflow: 'hidden', padding: `${u(S.facts * 0.62)} 0` }}>
      {c.isPrint ? (
        // Paper doesn't scroll: the items once, centered and whole - one line, or two balanced lines
        // on a narrow piece (door hanger), sized so the longer line fits the band.
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.facts * 0.35), padding: `0 ${u(P * 1.5 + P * 0.5)}`, fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: ink.fillInk, textAlign: 'center' }}>
          {(() => {
            const list = (wide && c.isPrint ? items.filter(x => !c.price || String(x).indexOf(c.price.value) < 0) : items).slice(0, tall || story ? 4 : 5).map(String)
            const roomy = tall || story || portrait ? 26 : wide && c.isPrint ? 999 : 52
            const total = list.join(' ✦ ').length
            let rows: string[][] = [list]
            if (total > roomy && list.length > 1) {
              let best = 1, diff = Infinity
              for (let k = 1; k < list.length; k++) {
                const d = Math.abs(list.slice(0, k).join(' ✦ ').length - list.slice(k).join(' ✦ ').length)
                if (d < diff) { diff = d; best = k }
              }
              rows = [list.slice(0, best), list.slice(best)]
            }
            const longest = Math.max(...rows.map(r => r.join(' ✦ ').length))
            const fs = wide && c.isPrint ? Math.min(S.facts * 1.05, 128 / (longest * 0.78)) : fit('x'.repeat(longest), S.facts * (tall || story ? 0.92 : 1), roomy, 0.55)
            return rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: u(fs * 0.8), whiteSpace: 'nowrap', fontSize: u(fs) }}>
                {r.map((it, n) => <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: u(fs * 0.8) }}>{n > 0 && <span style={{ opacity: 0.6 }}>✦</span>}{it}</span>)}
              </div>
            ))
          })()}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: u(S.facts * 1.1), whiteSpace: 'nowrap', fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: u(S.facts * (story || tall ? 1 : 1.05)), color: ink.fillInk, paddingLeft: u(P * 1.5 + S.facts * 1.4) }}>
          {[0, 1, 2].flatMap(r => items.map((it, n) => <span key={`${r}-${n}`} style={{ display: 'inline-flex', alignItems: 'center', gap: u(S.facts * 1.1) }}>{it}<span style={{ opacity: 0.6 }}>✦</span></span>))}
        </div>
      )}
    </Pick>
  )
  const oh = findOpenHouse(c)
  const ohDaysB = (() => {
    if (!oh) return []
    const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
    const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
    const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
    return days.map((d, k) => {
      const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
      const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
      return { wd, mon: m ? m[1] : '', day: m ? m[2] : rest, time: times.length > 1 ? times[k] ?? '' : times[0] ?? '' }
    })
  })()
  const askCta = c.leadGen ? (c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined) : undefined
  const calCardsEach = (inline: boolean) => ohDaysB.map((d, i) => {
        const ck = inline ? (story ? 1.4 : ohDaysB.length > 1 ? (ar < 0.9 ? 1.08 : 1) : 1.3) : social && !story ? (ar >= 0.9 ? 0.62 : 0.66) : social ? 1.02 : 1
        const W = (inline && ohDaysB.length > 1 ? 17.5 : 23) * ck
        const cut = 9
        const wdT = inline && ohDaysB.length > 1 ? d.wd.slice(0, 3) : d.wd
        const second = ohDaysB.length > 1 && i === 0
        const tLines = d.time.length > cut && d.time.includes('–') ? [d.time.slice(0, d.time.indexOf('–') + 1), d.time.slice(d.time.indexOf('–') + 1)] : d.time ? [d.time] : []
        const tFs = Math.min(2.6, (W - 3) / (Math.max(4, ...ohDaysB.flatMap(x => x.time.length > cut && x.time.includes('–') ? [x.time.slice(0, x.time.indexOf('–') + 1), x.time.slice(x.time.indexOf('–') + 1)] : [x.time]).map(l => l.length)) * 0.66))
        return (
          <Pick key={i} id={oh!.id} sel={sel} style={{ ...(inline ? { position: 'relative' as const, flexShrink: 0 } : { position: 'absolute' as const, top: u((2.2) * ck), ...(second ? { left: u((2.2) * ck) } : { right: u((2.2) * ck) }) }), width: u(W), zIndex: 2, transform: `rotate(${second ? -3 : 3}deg)`, filter: 'drop-shadow(0 0.8cqmin 1.6cqmin rgba(0,0,0,0.35))' }}>
            <div style={{ background: '#FFFDF9', borderRadius: u((1) * ck), overflow: 'hidden', textAlign: 'center' }}>
              <div style={{ background: ink.fill, color: ink.fillInk, fontFamily: t.fonts.label, fontWeight: 800, letterSpacing: '0.2em', paddingLeft: '0.2em', textTransform: 'uppercase', fontSize: u((1.9) * ck), padding: `${u((0.7) * ck)} 0` }}>{d.mon.slice(0, 3)}</div>
              <div style={{ padding: `${u((0.6) * ck)} ${u((0.6) * ck)} ${u((1) * ck)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u((0.3) * ck) }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: u((1) * ck), whiteSpace: 'nowrap' }}>
                  {wdT && <span style={{ fontFamily: t.fonts.label, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: u((Math.min(wdT.length <= 3 ? 2.3 : 1.9, 11 / (wdT.length * 0.8))) * ck), color: '#5A564E' }}>{wdT}</span>}
                  <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u((6.4) * ck), lineHeight: 1, color: '#16171B' }}>{d.day}</span>
                </div>
                {tLines.length > 0 && <div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', fontSize: u((tFs) * ck), lineHeight: 1.15, color: ink.fill, whiteSpace: 'nowrap', marginTop: u((0.5) * ck) }}>{tLines.map((l, k) => <div key={k}>{l}</div>)}</div>}
              </div>
            </div>
          </Pick>
        )
      })
  const calTallW = 20
  const calCards = (inline: boolean) => !(inline && story && ohDaysB.length > 1) ? calCardsEach(inline) : [(() => {
    const W = calTallW
    const mons = Array.from(new Set(ohDaysB.map(d => d.mon.slice(0, 3)).filter(Boolean)))
    const split = (x: string) => x.length > 9 && x.includes('–') ? [x.slice(0, x.indexOf('–') + 1), x.slice(x.indexOf('–') + 1)] : x ? [x] : []
    const tFs = Math.min(2.7, (W - 3) / (Math.max(4, ...ohDaysB.flatMap(d => split(d.time)).map(l => l.length)) * 0.66))
    return (
      <Pick key="tall" id={oh!.id} sel={sel} style={{ position: 'relative', flexShrink: 0, width: u(W), zIndex: 2, transform: 'rotate(3deg)', filter: 'drop-shadow(0 0.8cqmin 1.6cqmin rgba(0,0,0,0.35))' }}>
        <div style={{ background: '#FFFDF9', borderRadius: u(1.1), overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ background: ink.fill, color: ink.fillInk, fontFamily: t.fonts.label, fontWeight: 800, letterSpacing: '0.2em', paddingLeft: '0.2em', textTransform: 'uppercase', fontSize: u(2.1), padding: `${u(0.8)} 0` }}>{mons.join(' · ')}</div>
          {ohDaysB.map((d, i) => (
            <div key={i} style={{ padding: `${u(1)} ${u(0.8)} ${u(1.2)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.3), borderTop: i ? `${hair} solid ${hexA(ink.fill, 0.45)}` : undefined, margin: i ? `0 ${u(2)}` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: u(1), whiteSpace: 'nowrap' }}>
                {d.wd && <span style={{ fontFamily: t.fonts.label, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: u(2.4), color: '#5A564E' }}>{d.wd.slice(0, 3)}</span>}
                <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(7), lineHeight: 1, color: '#16171B' }}>{mons.length > 1 && d.mon ? <span style={{ fontSize: '0.5em', marginRight: '0.2em' }}>{d.mon.slice(0, 3)}</span> : null}{d.day}</span>
              </div>
              {d.time && <div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', fontSize: u(tFs), lineHeight: 1.15, color: ink.fill, whiteSpace: 'nowrap', marginTop: u(0.3) }}>{split(d.time).map((l, k) => <div key={k}>{l}</div>)}</div>}
            </div>
          ))}
        </div>
      </Pick>
    )
  })()]
  const plate = newLook && !!c.title && !c.leadGen
  const plateLines = c.title ? (c.title.text.length > 28 ? splitLines(c.title.text, 2) : [c.title.text]) : []
  const plateLong = plateLines.reduce((m, l) => (l.length > m.length ? l : m), '')
  const plateFs = c.title ? (tallLook ? Math.min(S.title * (social && !story ? 0.66 : story ? 0.92 : 0.7), (social ? (story ? 52 : 42) : 58) / (plateLong.length * 0.66)) : fit(plateLong, S.title * 0.56, 24, 0.7)) : 0
  const plateSub = S.sub * (tallLook ? (social && !story ? 0.82 : story ? 0.78 : 0.86) : 0.76)
  const plateHang = plate ? (plateFs * 1.05 + (c.sub ? plateSub * 1.3 + S.gap * 0.25 : 0) + 3) * 0.5 : 0
  const card = (style: CSSProperties) => (
    <div style={{ position: 'relative', zIndex: 2, ...style, ...(plate && style.marginBottom === undefined ? { marginBottom: u(plateHang) } : {}) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: u(2.4), overflow: 'hidden', boxShadow: '0 2.2cqmin 5cqmin rgba(0,0,0,0.42)' }}>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
        {!plate && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 22%, rgba(0,0,0,0) 50%)', pointerEvents: 'none' }} />}
        {oh && newLook && !ohSide && calCards(false)}
        {oh && !newLook && (
          <Pick id={oh.id} sel={sel} style={{ position: 'absolute', top: u(S.gap), left: '50%', transform: 'translateX(-50%)', background: ink.fill, color: ink.fillInk, borderRadius: ohLines(oh.date, oh.time).length > 1 ? u(S.facts * 0.9) : 999, padding: `${u(S.facts * 0.4)} ${u(S.facts * 0.9)}`, fontFamily: t.fonts.label, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: u(S.facts * 0.7), whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.35 }}>
            {ohLines(oh.date, oh.time).map(l => <div key={l}>{l}</div>)}
          </Pick>
        )}
        {c.title && !c.leadGen && !plate && (
          <Pick id={c.title.id} sel={sel} style={{ position: 'absolute', left: u(S.gap * 1.1), right: u(S.gap * 1.1), bottom: u(S.gap * 1.1) }}>
            <div style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, letterSpacing: t.display.tracking, whiteSpace: 'nowrap', fontSize: u(fit(c.title.text, S.title * (story || tall ? 0.62 : 0.5), 20, 0.7)), lineHeight: 1.05, color: '#FFFFFF', textShadow: '0 0.2cqmin 0.8cqmin rgba(0,0,0,0.55), 0 0.3cqmin 2.4cqmin rgba(0,0,0,0.45)' }}>{c.title.text}</div>
            {c.sub && <div style={{ marginTop: u(S.gap * 0.3), fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: u(S.sub * 0.72), color: 'rgba(255,255,255,0.86)', whiteSpace: 'nowrap' }}>{c.sub.text}</div>}
          </Pick>
        )}
      </div>
      {plate && c.title && (
        // the address on its own plate, hanging half off the photo so it always reads (user 10/12)
        <Pick className="ohp-plate" id={c.title.id} sel={sel} style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)', zIndex: 3, maxWidth: '108%', width: 'max-content', background: t.isDark ? '#1C1D22' : '#FFFDF9', border: `${hair} solid ${hexA(ink.accent, 0.6)}`, borderRadius: u(1), boxShadow: '0 1cqmin 2.6cqmin rgba(0,0,0,0.3)', padding: `${u(1.3)} ${u(3)} ${u(1.5)}`, textAlign: 'center' }}>
          <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', fontSize: u(plateFs), lineHeight: 1.05, color: t.isDark ? '#F4F1EA' : '#16171B' }}>{plateLines.map((l, i) => <div key={i}>{l}</div>)}</div>
          {c.sub && <div style={{ marginTop: u(S.gap * 0.25), fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', paddingLeft: '0.2em', fontSize: u(plateSub), color: ink.accent, whiteSpace: 'nowrap' }}>{c.sub.text}</div>}
        </Pick>
      )}
    </div>
  )
  const lead2 = c.leadGen && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
      {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body} align="left" style={{ display: '-webkit-box', WebkitLineClamp: tall ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
      {c.isPrint && !tall && <Details c={c} t={t} ink={ink} S={S} align="left" sel={sel} only={['cta']} />}
    </div>
  )
  const signOff = c.isPrint
    ? <div style={{ position: 'relative', zIndex: 3 }}><PrintSignOff c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} /></div>
    : (c.agent || c.logo) && (
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} compact={wide} />
        {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const glow = <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 50% at 85% 0%, ${hexA(ink.accent, 0.22)}, transparent 60%), ${T.strong}` }} />

  if (fam === 'banner') {
    return (
      <>
        {glow}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(P * 1.1), padding: `${u(P * 0.7)} ${u(P)} ${u(P * 0.4)}` }}>
            <div style={{ flex: '0 0 30%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{giant}</div>
            {card({ flex: '0 0 33%', minWidth: 0, transform: 'rotate(1.2deg)' })}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * 1.1) }}>
              {c.leadGen ? lead2 : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
                  <PriceHero c={c} t={t} ink={ink} size={S.price * 1.25} sel={sel} />
                  <FactsDots c={c} t={t} ink={ink} size={S.facts * 1.05} sel={sel} />
                </div>
              )}
              {(c.agent || c.logo) && <div style={{ borderTop: `${hair} solid ${ink.rule}`, paddingTop: u(S.gap * 0.7) }}><AgentBar c={c} t={t} ink={ink} S={scaled(S, 1.1)} sel={sel} fam={fam} compact /></div>}
            </div>
          </div>
          <div style={{ paddingBottom: u(P * 0.35) }}>{ticker}</div>
        </div>
      </>
    )
  }

  // Postcards (user 10/12): the features approved on the other themes, in Billboard's poster language -
  // the giant word, the price + stats on a framed card with a gold tab, the QR on its own framed card,
  // a slim footer, the band one line (no repeated price); lead-gen = a bigger paragraph + the ask on the QR card
  if (newLook) {
    const accent = ink.accent
    const onAccent = t.isDark ? '#15161A' : '#FFFFFF'
    const capsB: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.1 }
    const colW = social ? (story ? (100 - P * 2) * 0.86 : ar < 0.9 ? (100 - P * 2) * 0.8 : (100 - P * 2) * 0.4) : portrait ? 100 - P * 2 : 150 * 0.44
    const facts = findFacts(c)
    const fItems = social ? [...(facts?.items || []).filter(i => i.key !== 'property_type'), ...(c.lot && !(facts?.items || []).some(i => i.key === 'lot_size') ? [c.lot] : [])].slice(0, 4) : facts?.items || []
    const gridCols = social && fItems.length === 4 && !story && ar >= 0.9 ? 2 : fItems.length
    const tabText = c.price?.label || (c.situation === 'price_improvement' ? 'Now Offered At' : undefined)
    const frameB = (children: ReactNode, pad: string, tab?: string, style?: CSSProperties) => (
      <div style={{ position: 'relative', background: t.isDark ? 'rgba(255,255,255,0.06)' : '#FFFDF9', border: `${hair} solid ${hexA(accent, 0.55)}`, borderRadius: u(1.2), boxShadow: '0 0.8cqmin 2.2cqmin rgba(0,0,0,0.1)', padding: pad, ...style }}>
        {tab && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: accent, color: onAccent, ...capsB, letterSpacing: '0.24em', padding: `${u(0.7)} ${u(2)} ${u(0.7)} ${u(2.24)}`, borderRadius: u(0.5), fontSize: u(S.facts * 0.74), zIndex: 1 }}>{tab}</span>}
        {children}
      </div>
    )
    const innerW = colW - 6
    const pSize = c.price ? Math.min(S.price * (c.price.previous ? 0.95 : 1.05) * t.price.scale, (innerW - 2) / (c.price.value.length * 0.56)) * c.price.o.k : 0
    const sSize = facts ? Math.min(S.facts * (social ? 2.1 : 1.7), ...fItems.map(i => (innerW / gridCols - 1.5) / (Math.max(2, i.value.length) * 0.5))) : 0
    const priceCardB = !c.leadGen && (c.price || facts) && frameB(
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(1.1) }}>
        {c.price && <Pick id={c.price.id} sel={sel}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.5) }}>
          <span style={{ fontFamily: t.fonts.price, fontWeight: 600, letterSpacing: t.price.tracking, fontSize: u(pSize), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
          {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.7), color: ink.muted, textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
        </div></Pick>}
        {c.price && facts && (
          <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(1) }}>
            <span style={{ flex: 1, height: u(0.32), background: `linear-gradient(90deg, transparent, ${accent} 30%)` }} />
            <span style={{ width: u(1.3), height: u(1.3), background: accent, transform: 'rotate(45deg)' }} />
            <span style={{ flex: 1, height: u(0.32), background: `linear-gradient(270deg, transparent, ${accent} 30%)` }} />
          </div>
        )}
        {facts && <Pick id={facts.id} sel={sel}><div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
          {fItems.map((i, n) => (
            <div key={i.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.5), borderLeft: n % gridCols ? `${hair} solid ${hexA(accent, 0.35)}` : undefined, borderTop: n >= gridCols ? `${hair} solid ${hexA(accent, 0.35)}` : undefined, padding: gridCols < fItems.length ? `${u(1.1)} 0` : undefined, minWidth: 0 }}>
              <span style={{ fontFamily: t.fonts.price, fontWeight: 600, fontSize: u(sSize), color: ink.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
              <span style={{ ...capsB, color: accent, letterSpacing: '0.12em', fontSize: u(S.facts * 0.66) }}>{i.label}</span>
            </div>
          ))}
        </div></Pick>}
      </div>, `${u(2.6)} ${u(2.6)} ${u(1.8)}`, tabText
    )
    const askT = (askCta?.label || (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo')).replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())
    const qBig = (portrait || hanger) && c.leadGen
    const qs = S.qr * (qBig ? (hanger ? 1.25 : 1.35) : hanger ? 1.05 : 0.74)
    // the lead-gen letter's text column: as wide as its longest line (two balanced lines of the ask, or the scan line)
    const qAskLines = askT.length > 22 ? splitLines(askT, 2) : [askT]
    const qTextW = Math.min((hanger ? 100 - P * 2 : colW) - qs - 12, Math.max(...qAskLines.map(l => l.length * S.facts * (hanger ? 2.4 : 2.9) * 0.4), c.qr ? (c.qr.label || '').length * S.facts * 1.2 * 0.8 : 0) + 0.5)
    const qrCardB = c.qr && frameB(
      <Pick id={askCta?.id || c.qr.id} sel={sel}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: u(qs + 4.6), background: `linear-gradient(160deg, ${accent}, ${hexA(accent, 0.86)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <div style={{ borderRadius: u(0.5), padding: u(0.7), background: '#FFFFFF' }}><Qr c={c} t={t} ink={{ ...ink, ink: '#111111' }} size={qs} sel={sel} labelSide="none" /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(1.2), minHeight: u(qs + 5), paddingLeft: u(qs + 7.4), paddingRight: u(3.4), ...(qBig ? { width: u(qs + 7.4 + 3.4 + qTextW) , boxSizing: 'border-box' as const } : {}) }}>
          <FitLines text={askT} size={S.facts * (qBig ? (hanger ? 2.4 : 2.9) : hanger ? 2.2 : c.leadGen ? 1.75 : 1.85)} lines={askT.length > 22 ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.1, color: ink.ink, textWrap: 'balance' as any }} />
          {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...capsB, display: 'block', color: accent, letterSpacing: '0.14em', fontSize: u(Math.min(S.facts * (qBig ? 1.2 : 0.8), (colW - qs - 12) / (c.qr.label.length * 0.78))) }}>{c.qr.label}</span></Pick>}
        </div>
      </Pick>, '0', undefined, { overflow: 'hidden', alignSelf: 'center', width: 'fit-content', maxWidth: '100%' }
    )
    const ribbonWord = (c.leadGen ? (c.kicker?.text || word) : newsWord(c)).toUpperCase()
    const ribbonTown = !c.leadGen && c.sub && !c.townOnly ? placeName(c).toUpperCase() : ''
    const ribbonBits = social ? [oh ? 'OPEN HOUSE' : ribbonWord] : oh && ohDaysB.length ? ['OPEN HOUSE', ohDaysB.map(d => `${d.wd ? d.wd + ', ' : ''}${d.mon} ${d.day}`).join(' & ').toUpperCase()] : ribbonTown ? [ribbonWord, ribbonTown] : [ribbonWord]
    const ribbon = (
      <Pick className="ohp-ribbon" id={c.leadGen ? c.kicker?.id : (c.big?.id || c.kicker?.id)} sel={sel} style={{ position: 'relative', zIndex: 3, margin: `0 ${u(-P * 1.5)}`, transform: 'rotate(-1.4deg)', background: ink.fill, boxShadow: '0 0.8cqmin 2cqmin rgba(0,0,0,0.22)', overflow: 'hidden', padding: `${u(S.facts * (hanger ? 0.45 : portrait || social ? 0.9 : 0.62))} 0` }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: u(S.facts * 1.1), whiteSpace: 'nowrap', fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.facts * (hanger ? 0.85 : portrait || social ? 1.3 : 1.02)), color: ink.fillInk }}>
          {hanger ? Array.from({ length: 9 }).flatMap((_, k) => ribbonBits.map((x, j) => <span key={`${k}-${j}`} style={{ display: 'inline-flex', alignItems: 'center', gap: u(S.facts * 1.1) }}>{k || j ? <span style={{ opacity: 0.6 }}>✦</span> : null}{x}</span>)) : Array.from({ length: 8 }).flatMap((_, k) => ribbonBits.map((x, j) => <span key={`${k}-${j}`} style={{ display: 'inline-flex', alignItems: 'center', gap: u(S.facts * 1.1) }}>{x}<span style={{ opacity: 0.6 }}>✦</span></span>))}
        </div>
      </Pick>
    )
    const footerB = (c.agent || c.finePrint) && (
      <div data-foot="" style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.55), width: '100%', position: 'relative', zIndex: 3 }}>
        {c.agent && <>
          <Rule color={ink.rule} />
          <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap), ...(hanger ? { flexDirection: 'column' as const, gap: u(S.gap * 0.6) } : {}) }}>
            <div style={{ flex: hanger ? undefined : '1 1 auto', minWidth: 0 }}><AgentCard fitLong c={c} t={t} ink={ink} S={S} sel={sel} align={hanger ? 'center' : 'left'} scale={hanger ? 1.1 : 0.92} showContact={false} noTitle /></div>
            <div style={{ flexShrink: 0 }}><SplitContacts splitMail c={c} t={t} ink={ink} S={S} sel={sel} scale={hanger ? 0.95 : 0.62} /></div>
          </div>
        </>}
        <FinePrint c={c} ink={ink} t={t} size={S.fine} oneLine={!hanger} />
      </div>
    )
    if (social) {
      // Social posts (user 10/12): the approved letter pieces on the feed - the giant word on one line (or
      // the centred lead-gen group), the photo at 3:2 with its centred address / calendar cards, the price
      // card (beside the photo on the square + 4:5, under it on the story), the ask on its own card, the
      // status ribbon, then the sign-off with the Instagram button
      const sKick = c.kicker?.text || ''
      const sQ = splitLines((c.title?.text || '').toUpperCase(), 2)
      const fullW = 100 - P * 2
      const sQFs = Math.min(story ? 10 : (ar < 0.9 ? 8.4 : 7.6) - (c.socialButton ? 0.9 : 0), (fullW - 1) / (Math.max(6, ...sQ.map(l => l.length)) * charW * 0.8))
      const sRule = <span aria-hidden style={{ width: u(8), height: hair, background: accent }} />
      const askCardS = c.leadGen && askCta && frameB(
        <Pick id={askCta.id} sel={sel}><FitLines text={askT} size={S.facts * (story ? 2.6 : ar < 0.9 ? 3 : 2.5)} lines={story && askT.length > 26 ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.1, color: ink.ink, textAlign: 'center', textWrap: 'balance' as any }} /></Pick>,
        `${u(2.4)} ${u(3.6)}`, undefined, { alignSelf: 'center', width: '100%', boxShadow: '0 1.4cqmin 3cqmin rgba(0,0,0,0.25)' }
      )
      const leadGroup = c.leadGen && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.gap * 0.8), width: '100%' }}>
          {sKick && <Pick id={c.kicker!.id} sel={sel}><div style={{ display: 'flex', alignItems: 'center', gap: u(2.2) }}>{sRule}<span style={{ ...capsB, color: accent, letterSpacing: '0.3em', paddingLeft: '0.3em', fontSize: u(Math.min(S.kicker * 1.2, (fullW - 24) / (sKick.length * 0.9))) }}>{sKick}</span>{sRule}</div></Pick>}
          {c.title && <Pick id={c.title.id} sel={sel}><div>{sQ.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: u(sQFs), lineHeight: 0.98, color: i % 2 ? accent : ink.ink, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
          {c.sub && <div style={{ width: '92%' }}><Lede text={c.sub.text} t={t} ink={ink} size={S.body * (story ? 1.25 : ar < 0.9 ? 1.32 : 1.05)} align="center" style={{ display: '-webkit-box', WebkitLineClamp: story ? 4 : ar < 0.9 ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} /></div>}
        </div>
      )
      const side = !story && !c.leadGen && ar >= 0.9
      return (
        <>
          {glow}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: hanger ? '17cqh 0 2.2cqh' : story ? '6.5cqh 0 8cqh' : `${u(P * 0.7)} 0 ${u(P * 0.55)}` }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', gap: u(S.gap * 1.1), padding: `0 ${u(P)} ${u(2)}` }}>
              {c.leadGen ? leadGroup : ohSide ? (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(3) }}>
                  {giant}
                  <div style={{ display: 'flex', flexDirection: story ? 'column' : 'row', gap: u(story ? 1.1 : 2.4), alignItems: story ? 'center' : 'flex-start' }}>{calCards(true)}</div>
                </div>
              ) : <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{giant}</div>}
              {side ? (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: u(3) }}>
                  {card({ flex: c.leadGen ? '0 0 48%' : ohSide || bigStack ? '0 0 50%' : '0 0 54%', aspectRatio: '3 / 2', transform: 'rotate(-1.2deg)' })}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{c.leadGen ? askCardS : priceCardB}</div>
                </div>
              ) : c.leadGen ? (<>
                <div style={{ position: 'relative', flexShrink: 0, width: u(fullW * ((hanger ? 0.94 : story ? 0.86 : ar < 0.9 ? 0.8 : 0.48) - (c.socialButton ? (story ? 0.14 : 0.1) : 0))), marginBottom: u(hanger ? 0 : story ? 7 : 4.6) }}>
                  {card({ width: '100%', aspectRatio: '3 / 2', transform: 'rotate(-1deg)' })}
                  {!hanger && <div data-ask="" style={{ position: 'absolute', left: '50%', bottom: u(story ? -7 : -4.6), width: story ? '96%' : ar < 0.9 ? '106%' : '124%', transform: 'translateX(-50%) rotate(-2.5deg)', zIndex: 4, display: 'flex', justifyContent: 'center' }}>{askCardS}</div>}
                </div>
                {hanger && qrCardB && <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', width: '100%' }}>{qrCardB}</div>}
              </>) : <>
                {card({ flexShrink: 0, width: u(fullW * (hanger ? 0.84 : story ? (c.socialButton ? 0.76 : 0.84) : c.socialButton ? 0.58 : 0.66)), aspectRatio: '3 / 2', transform: 'rotate(-1deg)' })}
                {priceCardB && <div style={{ width: u(colW + 4), marginTop: u(hanger ? 3.5 : 0) }}>{priceCardB}</div>}
                {hanger && qrCardB && <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', width: '100%' }}>{qrCardB}</div>}
              </>}
            </div>
            <div style={{ marginTop: u(story ? 1.6 : c.leadGen ? 2.6 : -0.8), marginBottom: u(story ? 2 : 3.4) }}>{ribbon}</div>
            <div style={{ padding: `${u(1.2)} ${u(P)} 0` }}>{hanger ? footerB : signOff}</div>
          </div>
        </>
      )
    }
    if (portrait) {
      // Letters / flyers (user 10/12): the approved postcard pieces, stood up - the giant word (or the centred
      // lead-gen group), the photo card with its calendar cards, the framed price card, the story, the
      // centred QR card, the status ribbon, the slim footer
      const descB = c.details.find(d => d.kind === 'description') as Extract<DetailItem, { kind: 'description' }> | undefined
      const kick = c.kicker?.text || ''
      const qLines = splitLines((c.title?.text || '').toUpperCase(), (c.title?.text || '').length > 32 ? 3 : 2)
      const qFs = Math.min(11, (colW - 1) / (Math.max(6, ...qLines.map(l => l.length)) * charW * 0.8))
      const rule = <span aria-hidden style={{ width: u(9), height: hair, background: accent }} />
      return (
        <>
          {glow}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', gap: u(S.gap * 1.1), padding: `${u(P * 0.8)} ${u(P)} ${u(2.4)}` }}>
              {c.leadGen ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.gap * 0.9), width: '100%' }}>
                  {kick && <Pick id={c.kicker!.id} sel={sel}><div style={{ display: 'flex', alignItems: 'center', gap: u(2.4) }}>{rule}<span style={{ ...capsB, color: accent, letterSpacing: '0.3em', paddingLeft: '0.3em', fontSize: u(Math.min(S.kicker * 1.3, (colW - 26) / (kick.length * 0.9))) }}>{kick}</span>{rule}</div></Pick>}
                  {c.title && <Pick id={c.title.id} sel={sel}><div>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: u(qFs), lineHeight: 0.98, color: i % 2 ? accent : ink.ink, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
                  {c.sub && <div style={{ width: '88%' }}><Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.3} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} /></div>}
                </div>
              ) : <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{giant}</div>}
              {/* the whole photo at its proper 3:2 - never squeezed into a strip */}
              {card({ flexShrink: 0, width: u(colW * (c.leadGen ? 0.6 : 0.76)), aspectRatio: '3 / 2', transform: 'rotate(-1deg)' })}
              {c.leadGen
                ? qrCardB && <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', width: '100%' }}>{qrCardB}</div>
                : <>
                  {/* the price + stats and the QR, side by side */}
                  <div style={{ flexShrink: 0, width: '100%', display: 'flex', alignItems: 'stretch', gap: u(2.6), marginTop: u(1.4) }}>
                    {priceCardB && <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{priceCardB}</div>}
                    {qrCardB && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{qrCardB}</div>}
                  </div>
                  {descB && <Pick id={descB.id} sel={sel} style={{ width: '88%', flexShrink: 0 }}><Lede text={descB.text} t={t} ink={ink} size={S.body * 1.05} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }} /></Pick>}
                </>}
            </div>
            <div style={{ marginTop: u(0.6), marginBottom: u(1.6) }}>{ribbon}</div>
            <div style={{ padding: `${u(1.6)} ${u(P)} ${u(P * 0.55)}` }}>{footerB}</div>
          </div>
        </>
      )
    }
    return (
      <>
        {glow}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(P * 0.9), padding: `${u(P * 0.7)} ${u(P)} ${u(P * 0.35)}` }}>
            <div style={{ flex: '0 0 44%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: c.leadGen ? 'center' : 'space-between', alignItems: c.leadGen ? 'center' : 'stretch', gap: u(S.gap * (c.leadGen ? 1.2 : 0.9)) }}>
              {c.leadGen ? (() => {
                const kick = c.kicker?.text || ''
                const qLines = splitLines((c.title?.text || '').toUpperCase(), (c.title?.text || '').length > 32 ? 3 : 2)
                const qFs = Math.min(9.5, (colW - 1) / (Math.max(6, ...qLines.map(l => l.length)) * charW * 0.8))
                const rule = <span aria-hidden style={{ width: u(7), height: hair, background: accent }} />
                return <>
                  {kick && <Pick id={c.kicker!.id} sel={sel}><div style={{ display: 'flex', alignItems: 'center', gap: u(2) }}>{rule}<span style={{ ...capsB, color: accent, letterSpacing: '0.3em', paddingLeft: '0.3em', fontSize: u(Math.min(S.kicker * 1.15, (colW - 20) / (kick.length * 0.9))) }}>{kick}</span>{rule}</div></Pick>}
                  {c.title && <Pick id={c.title.id} sel={sel}><div style={{ textAlign: 'center' }}>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: u(qFs), lineHeight: 0.98, color: i % 2 ? accent : ink.ink, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>}
                  {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.2} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
                  <span aria-hidden style={{ width: u(14), height: u(0.45), borderRadius: u(0.3), background: accent }} />
                  {qrCardB}
                </>
              })() : <>
                {giant}
                {priceCardB && <div style={{ flexShrink: 0 }}>{priceCardB}</div>}
                {qrCardB && <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}>{qrCardB}</div>}
              </>}
            </div>
            {card({ flex: 1, minWidth: 0, transform: 'rotate(1.2deg)' })}
          </div>
          {/* the status ribbon, then the slim footer across the full width (user 10/12) */}
          <div style={{ marginTop: u(1.6), marginBottom: u(1) }}>{ribbon}</div>
          <div style={{ padding: `${u(2)} ${u(P)} ${u(P * 0.45)}` }}>{footerB}</div>
        </div>
      </>
    )
  }

  if (wide) {
    return (
      <>
        {glow}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(P * 0.9), padding: `${u(P * 0.8)} ${u(P)} ${u(P * 0.55)}` }}>
            <div style={{ flex: '0 0 44%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap) }}>
              {giant}
              {lead2}
              {!c.leadGen && (c.price || findFacts(c)) && (
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.75) }}>
                  <Dash ink={ink} w={8} />
                  <PriceHero c={c} t={t} ink={ink} size={S.price * 1.12} sel={sel} />
                  <FactsDots c={c} t={t} ink={ink} size={S.facts * 0.92} sel={sel} />
                </div>
              )}
              {signOff}
            </div>
            {card({ flex: 1, minWidth: 0, transform: 'rotate(1.2deg)' })}
          </div>
          <div style={{ paddingBottom: u(P * 0.55) }}>{ticker}</div>
        </div>
      </>
    )
  }

  const top = tall ? u(HANGER_ZONE + 2) : story ? '11cqh' : u(P * 0.75)
  return (
    <>
      {glow}
      <div style={{ position: 'absolute', inset: 0, padding: `${top} ${u(P)} ${story ? '11cqh' : u(P * 0.7)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
        {giant}
        {lead2}
        {card({ flex: 1, minHeight: u(30), marginTop: u(-giantH * (lead2 ? 0.06 : 0.16)), transform: 'rotate(-1deg)' })}
        {ticker}
        {(portrait || tall) && !c.leadGen && <PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="left" clamp={tall ? 4 : 2} />}
        {signOff}
      </div>
    </>
  )
}

// ── Slant: the photo full-bleed, a bold slab cut on a diagonal with a bright edge, and a round
// price sticker riding the corner.
// Slant social posts (user 10/10): each open house day as a little tear-off calendar card - month band,
// big day number, weekday, and that day's hours. One card for one day, two for a weekend.
// Sizes whatever it renders (by width w, in cqmin) so its bottom edge lines up with the bottom of the
// design's address line ([data-addr]) - re-measured after fonts load. (Slant square posts, user 10/11.)
function MatchAddressBottom({ base, min, max, render, target: sel = '[data-addr]' }: { base: number; min: number; max: number; render: (w: number) => ReactNode; target?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(base)
  const [, setTick] = useState(0)
  useEffect(() => {
    document.fonts?.ready.then(() => setTick(n => n + 1)).catch(() => {})
    const id = setTimeout(() => setTick(n => n + 1), 350)
    return () => clearTimeout(id)
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let root: HTMLElement | null = el.parentElement
    while (root && !root.querySelector(sel)) root = root.parentElement
    const target = root?.querySelector(sel)
    if (!target) return
    const r = el.getBoundingClientRect()
    const h = r.height
    if (h <= 0) return
    const next = Math.max(min, Math.min(max, w * (target.getBoundingClientRect().bottom - r.top) / h))
    if (Math.abs(next - w) > 0.12) setW(next)
  })
  return <div ref={ref}>{render(w)}</div>
}

function CalendarCards({ oh, t, sel, fill, fillInk, w, cord = 0, spread = 0.16 }: { oh: Extract<DetailItem, { kind: 'openHouse' }>; t: DesignTheme; sel: Sel; fill: string; fillInk: string; w: number; cord?: number; spread?: number }) {
  // "2 PM–4 PM" (the editor's time pickers) reads as "2–4 PM"
  const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
  const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
  const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
  const cards = days.map((d, i) => {
    const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
    const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
    return { wd: wd.slice(0, 3), mon: m ? m[1].slice(0, 3) : rest.slice(0, 3), day: m ? m[2] : '', time: times[i] ?? times[0] ?? '' }
  })
  const lines = (x: string) => (x.length > 11 && x.includes('–') ? [x.slice(0, x.indexOf('–') + 1), x.slice(x.indexOf('–') + 1).trim()] : [x])
  const label: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.1 }
  const timeSize = Math.min(...cards.flatMap(c => lines(c.time)).map(l => fit(l, w * 0.14, 7.5, 0.5)))
  return (
    <Pick id={oh.id} sel={sel} style={{ display: 'flex', gap: u(w * spread), paddingTop: u(cord) }}>
      {cards.map((c, i) => (
        <div key={i} style={{ position: 'relative' }}>
        {/* hung from the price sticker: a cord to each card's two rings */}
        {cord > 0 && ['26%', '74%'].map(x => <span key={x} aria-hidden style={{ position: 'absolute', left: x, top: u(-cord - 1), width: u(0.45), height: u(cord + w * 0.12), background: fill, transform: `translateX(-50%) rotate(${i ? 4 : -3}deg)`, transformOrigin: 'bottom', borderRadius: u(0.3) }} />)}
        <div style={{ position: 'relative', width: u(w), background: '#FFFDF8', borderRadius: u(w * 0.1), boxShadow: '0 0.9cqmin 2.2cqmin rgba(0,0,0,0.22)', transform: `rotate(${i ? 4 : -3}deg)`, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: u(w * 0.09) }}>
          <div style={{ alignSelf: 'stretch', background: fill, color: fillInk, textAlign: 'center', padding: `${u(w * 0.1)} 0 ${u(w * 0.06)}`, position: 'relative' }}>
            <span aria-hidden style={{ position: 'absolute', top: u(w * 0.05), left: '24%', width: u(w * 0.07), height: u(w * 0.07), borderRadius: '50%', background: 'rgba(0,0,0,0.28)' }} />
            <span aria-hidden style={{ position: 'absolute', top: u(w * 0.05), right: '24%', width: u(w * 0.07), height: u(w * 0.07), borderRadius: '50%', background: 'rgba(0,0,0,0.28)' }} />
            <span style={{ ...label, fontSize: u(fit(c.wd ? `${c.wd} · ${c.mon}` : c.mon, w * 0.15, 6.5, 0.5)), letterSpacing: '0.1em', paddingLeft: '0.1em' }}>{c.wd ? `${c.wd} · ${c.mon}` : c.mon}</span>
          </div>
          <span style={{ fontFamily: t.fonts.display, fontWeight: 700, fontSize: u(w * 0.44), lineHeight: 1, color: '#1B1A17', marginTop: u(w * 0.05) }}>{c.day}</span>
          {c.time && <span aria-hidden style={{ width: '56%', height: hair, background: hexA(fill, 0.5), margin: `${u(w * 0.05)} 0 ${u(w * 0.04)}` }} />}
          {lines(c.time).map(l => <span key={l} style={{ ...label, fontSize: u(timeSize), letterSpacing: '0.02em', color: '#1B1A17' }}>{l}</span>)}
        </div>
        </div>
      ))}
    </Pick>
  )
}

function Slant({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  // Slant, elevated (user 10/10): every format is built from the postcard's pieces - a title-case serif
  // header with a gold rule, the paragraph in a tinted panel, and white cards in one family (gold
  // hairline, a corner cut on the slant's angle): the price + stats card (with a gold band), the open
  // house card and the scan card. Social posts have no QR; their open house days hang as calendar cards.
  const story = fam === 'story'
  const tall = fam === 'tall'
  const portrait = fam === 'portrait'
  const wide = fam === 'landscape' || fam === 'banner'
  // lead-gen hangers have room to spare: undo the long-headline shrink so Make Me Sell sets at the same
  // size and spacing as Home Valuation (user 10/11)
  const S = wide ? scaled(S0, (c.isPrint ? 0.8 : 0.86) * (c.isPrint && c.leadGen ? 1 / densityScale(c) : 1)) : (fam === 'tall' || fam === 'portrait') && c.leadGen ? scaled(S0, 1 / densityScale(c)) : S0
  const S1 = S
  const P = S.pad
  const T = tones(t)
  const ink = T.onStrong
  const gold = ink.fill
  const goldInk = ink.fillInk
  const oh = findOpenHouse(c)
  const kick = c.kicker
  const social = !c.isPrint
  const pcard = wide && c.isPrint
  const facts = findFacts(c)
  const showPrice = !c.leadGen && !!c.price
  // Where the slab's top edge sits, as % of the height: higher on the right, so it climbs.
  const feed = (fam === 'square' && ar < 0.9) || story // tall posts: the 4:5 and the story share one design
  const H = story && c.leadGen ? (c.situation === 'social_ad' ? 57 : 60) : story ? ((c.title?.text.length || 0) > 24 ? 62 : 61) : feed && !c.leadGen ? ((c.title?.text.length || 0) > 24 ? 61 : 58) : tall ? (c.leadGen ? 53 : oh ? 65 : 61) : portrait ? (c.leadGen ? 60 : oh ? 68 : 63) : fam === 'square' ? (c.leadGen ? (ar < 0.9 ? (c.situation === 'home_valuation' ? 57 : c.situation === 'social_ad' ? 58 : 54) : 68) : oh ? 48.5 : (c.title?.text.length || 0) > 24 ? 50 : 48) : 46
  const left = 100 - H * 0.74
  const flatStory = story && showPrice && !oh // story listings: a gentler pitch
  const right = flatStory ? 100 - H * 0.74 - H * 0.15 : 100 - H
  const edge = story || tall ? 1.4 : 2.2
  const cutTR = 'polygon(0 0, calc(100% - 4cqmin) 0, 100% 4.5cqmin, 100% 100%, 0 100%)'
  const cutTL = 'polygon(4cqmin 0, 100% 0, 100% 100%, 0 100%, 0 4.5cqmin)'
  const shadow = 'drop-shadow(0 0.7cqmin 1.6cqmin rgba(0,0,0,0.16))'
  const caps: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.15 }

  const askCta = c.leadGen ? (c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined) : undefined
  const listingAsk = !c.leadGen && c.qr ? (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo') : ''
  const scanAsk = askCta?.label || listingAsk
  // the scan card sits on the photo for lead-gen pieces (corner cut top-left, toward the slant), in the
  // words column for listings (corner cut top-right)
  const scanOnPhoto = c.leadGen
  // w = the card's width in cqmin: the ask is sized to sit on at most two lines in what's left of it
  const scanCardFor = (w: number) => {
    if (!c.isPrint || !c.qr || !scanAsk) return null
    const cut = scanOnPhoto ? cutTL : cutTR
    const wideCard = portrait && !scanOnPhoto // the wide letter card: the arrow centred in the room between
    if (wideCard) {
      const qs2 = S.qr * 1.55
      const notch = S.gap * 1.3
      return (
        <Pick id={askCta?.id || c.qr!.id} sel={sel} style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: u(S.gap * 1.6 + notch * 0.5) }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0, background: '#FFFFFF', border: `${hair} solid ${hexA(gold, 0.85)}`, borderRadius: u(S.gap * 3), boxShadow: '0 0.6cqmin 1.6cqmin rgba(0,0,0,0.10)', padding: `${u(S.gap * 1.1)} ${u(S.gap * 1.6)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.facts * 0.35) }}>
            <span aria-hidden style={{ position: 'absolute', right: u(-notch / 2 - 0.05), top: '50%', width: u(notch), height: u(notch), background: '#FFFFFF', borderTop: `${hair} solid ${hexA(gold, 0.85)}`, borderRight: `${hair} solid ${hexA(gold, 0.85)}`, transform: 'translateY(-50%) rotate(45deg)', borderTopRightRadius: u(notch * 0.15) }} />
            <FitLines text={scanAsk} size={S.facts * 2.6} lines={scanAsk.length <= 26 ? 1 : 2} style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.1, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} />
            {c.qr!.label && <Pick id={c.qr!.id} sel={sel}><span style={{ ...caps, letterSpacing: '0.15em', fontSize: u(fit(c.qr!.label, S.facts * 1, 20.5, 0.6)), color: gold }}>{c.qr!.label}</span></Pick>}
          </div>
          <div style={{ flexShrink: 0, filter: 'drop-shadow(0 0.8cqmin 1.8cqmin rgba(0,0,0,0.18))' }}>
            <Qr c={c} t={t} ink={{ ...ink, onPhoto: false, rule: hexA(gold, 0.6) }} size={qs2} sel={sel} labelSide="none" />
          </div>
        </Pick>
      )
    }
    const qs = S.qr * (portrait && !scanOnPhoto ? 1.15 : oh && !scanOnPhoto ? 1.02 : tall ? 1.05 : 1.2)
    const slim = tall && scanOnPhoto
    const arrowW = S.facts * (slim ? 1.55 : 2)
    const textW = Math.max(12, w - qs - arrowW - S.gap * (scanOnPhoto ? 4.6 : 4) - 1)
    return (
      <Pick id={askCta?.id || c.qr!.id} sel={sel} style={{ position: 'relative', alignSelf: 'stretch', filter: wideCard ? undefined : shadow }}>
        <div style={{ background: wideCard ? 'transparent' : gold, padding: wideCard ? 0 : hair, clipPath: wideCard ? undefined : cut }}>
          <div style={{ background: wideCard ? T.strong : '#FFFFFF', clipPath: cut, display: 'flex', alignItems: 'center', padding: `${u(S.gap * 0.9)} ${u(S.gap * 1.1)} ${u(S.gap * 0.9)} ${u(S.gap * (slim ? 1.25 : scanOnPhoto ? 2 : 1.3))}` }}>
            <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0, marginRight: u(S.gap * (slim ? 0.5 : tall ? 0.6 : 0.8)) }} />
            <div style={{ flex: wideCard ? '0 1 auto' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.facts * 0.3) }}>
              <FitLines text={scanAsk} size={S.facts * (tall ? 2.9 : portrait ? (scanOnPhoto ? 2.5 : 2.9) : 1.9)} lines={scanAsk.length <= 14 ? 1 : 2} style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.1, color: '#1B1A17', textWrap: 'balance' as any }} />
              {c.qr!.label && <Pick id={c.qr!.id} sel={sel}><span style={{ ...caps, letterSpacing: '0.18em', fontSize: u(fit(c.qr!.label, S.facts * (tall ? 0.8 : 0.7), slim ? 18.6 : tall ? 16 : 22, 0.6)), color: gold }}>{c.qr!.label}</span></Pick>}
            </div>
            {/* the arrow sits centred in the space between the words and the code */}
            <div style={{ flex: wideCard ? 1 : '0 0 auto', display: 'flex', justifyContent: 'center', padding: `0 ${u(S.gap * (slim ? 0.35 : tall ? 0.6 : 1.1))}` }}>
              <svg viewBox="0 0 34 24" fill="none" stroke={gold} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(arrowW), height: u(S.facts * 1.4), flexShrink: 0 }}>
                {wideCard ? <><path d="M3 12 H30" /><path d="M24 6.5 L30.5 12 L24 17.5" /></> : <><path d="M3 19 C 10 19, 14 11, 30 11" /><path d="M24 5.5 L30.5 11 L24 16.5" /></>}
              </svg>
            </div>
            <Qr c={c} t={t} ink={{ ...ink, onPhoto: false, rule: hexA(gold, 0.5) }} size={qs} sel={sel} labelSide="none" />
          </div>
        </div>
      </Pick>
    )
  }
  const scanCard = !!(c.isPrint && c.qr && scanAsk)
  const cutBL = 'polygon(0 0, 100% 0, 100% 100%, 4cqmin 100%, 0 calc(100% - 4.5cqmin))'
  const QR_ARROW = 1 as number // the user picked 1 (10/11): the bubble's pointer only. 2 = short straight arrow, 3 = upturned swoosh
  const qrTower = (w: number, qs: number, _tilt = 0, big = 1) => {
    if (!c.isPrint || !c.qr || !scanAsk) return null
    const gap = S.gap * (QR_ARROW === 2 ? 3.4 : 1.5) * big
    const askSize = S.facts * 1.8 * big
    const padY = S.gap * 0.85 * big
    const ph = askSize * 1.1 + S.facts * 0.3 * big + S.facts * 0.95 * big * 1.25 + padY * 2
    const pw = Math.min(w, Math.max(qs + 4, w * 0.9))
    const notch = S.gap * 1.2 * big
    return (
      <Pick id={askCta?.id || c.qr!.id} sel={sel} style={{ position: 'relative', width: u(w), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(gap) }}>
        <div style={{ filter: 'drop-shadow(0 0.8cqmin 1.8cqmin rgba(0,0,0,0.18))' }}>
          <Qr c={c} t={t} ink={{ ...ink, onPhoto: false, rule: hexA(gold, 0.6) }} size={qs} sel={sel} labelSide="none" />
        </div>
        {QR_ARROW === 2 && (
          <svg viewBox="0 0 16 40" fill="none" stroke={gold} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: '50%', top: u(qs + gap * 0.14), width: u(gap * 0.4), height: u(gap * 0.72), transform: 'translateX(-50%)' }}>
            <path d="M8 38 V4" />
            <path d="M2 10 L8 3.5 L14 10" />
          </svg>
        )}
        {QR_ARROW === 3 && (
          <svg viewBox="0 0 34 24" fill="none" stroke={gold} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: u((w - pw) / 2 + pw * 0.06), top: u(qs + gap - S.facts * 2.6 * big), width: u(S.facts * 2.6 * big), height: u(S.facts * 1.84 * big), transform: 'rotate(-62deg)', transformOrigin: '0% 100%' }}>
            <path d="M3 19 C 10 19, 14 11, 30 11" />
            <path d="M24 5.5 L30.5 11 L24 16.5" />
          </svg>
        )}
        <div style={{ position: 'relative', width: u(pw), minHeight: u(ph), boxSizing: 'border-box', background: '#FFFFFF', border: `${hair} solid ${hexA(gold, 0.85)}`, borderRadius: u(ph * 0.5), boxShadow: '0 0.6cqmin 1.6cqmin rgba(0,0,0,0.10)', padding: `${u(padY)} ${u(S.gap * 1.2 * big)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: u(S.facts * 0.3 * big) }}>
          {QR_ARROW === 1 && <span aria-hidden style={{ position: 'absolute', top: u(-notch / 2 - 0.05), left: '50%', width: u(notch), height: u(notch), background: '#FFFFFF', borderTop: `${hair} solid ${hexA(gold, 0.85)}`, borderLeft: `${hair} solid ${hexA(gold, 0.85)}`, transform: 'translateX(-50%) rotate(45deg)', borderTopLeftRadius: u(notch * 0.15) }} />}
          <FitLines text={scanAsk} size={askSize} lines={scanAsk.length <= 26 ? 1 : 2} style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.1, color: '#1B1A17', textAlign: 'center', textWrap: 'balance' as any }} />
          {c.qr!.label && <Pick id={c.qr!.id} sel={sel}><span style={{ ...caps, letterSpacing: '0.15em', fontSize: u(fit(c.qr!.label, S.facts * 0.95 * big, 20.5, 0.6)), color: gold }}>{c.qr!.label}</span></Pick>}
        </div>
      </Pick>
    )
  }
  // the price + stats card (user 10/10: in the scan card's family, with more colour) - a gold band for the
  // price, then each stat over its label on white
  const statItems = [...(facts?.items || []).filter(i => i.key !== 'property_type'), ...(c.lot && !(facts?.items || []).some(i => i.key === 'lot_size') ? [c.lot] : [])].slice(0, 4)
  const STAT: Record<string, string> = { Bed: 'Bed', Beds: 'Beds', Bath: 'Bath', Baths: 'Baths', 'Sq Ft': 'Sq Ft', Acres: 'Acres', 'Sq Ft Lot': 'Lot' }
  // (user 10/10) the price card lives bottom-right: the price set to the right of its gold band, the
  // card's left edge cut on the slant's lean so there's no dead space left of the price
  const priceSizeFor = (w: number) => c.price ? Math.min(S.price * 0.95 * (social ? 1.15 : 1), (w * 0.62) / Math.max(6, c.price.value.length) / 0.55) * c.price.o.k : 0
  // the band's size, estimated, so a card can be set with the slant line running into the band's angled end
  const bandOf = (w: number) => {
    const ps = priceSizeFor(w)
    const pw = c.price ? c.price.value.length * 0.56 * ps : 0
    return { w: Math.min(w, pw + 6.5 + S.gap * 1.3), h: S.facts * 0.75 + ps + S.gap * 1.6 + (c.price?.previous ? S.facts * 0.8 : 0) }
  }
  const priceCard = (w: number) => showPrice && c.price ? (
    <Pick id={c.price.id} sel={sel} style={{ width: u(w), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', filter: 'drop-shadow(0 1cqmin 2.4cqmin rgba(0,0,0,0.3))' }}>
      <div style={{ position: 'relative', zIndex: 1, background: gold, color: goldInk, clipPath: 'polygon(5cqmin 0, 100% 0, 100% 100%, 0 100%)', padding: `${u(S.gap * 0.8)} ${u(S.gap * 1.3)} ${u(S.gap * 0.8)} ${u(6.5)}`, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', gap: u(S.gap * 0.2), marginBottom: '-1px' }}>
        <span style={{ ...caps, letterSpacing: '0.2em', fontSize: u(S.facts * 0.6), opacity: 0.92 }}>{c.price.label || (c.situation === 'price_improvement' ? 'Now' : 'Offered at')}</span>
        <span style={{ fontFamily: t.fonts.price, fontWeight: t.styleId === 'minimal' ? 800 : t.price.weight, fontSize: u(priceSizeFor(w)), lineHeight: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
        {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.62), textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
      </div>
      {statItems.length > 0 && (
        <Pick id={facts?.id} sel={sel} style={{ alignSelf: 'stretch', background: '#FFFFFF', border: `${hair} solid ${hexA(gold, 0.9)}`, display: 'grid', gridTemplateColumns: `repeat(${statItems.length}, 1fr)`, padding: `${u(S.gap * 0.75)} ${u(S.gap * 0.4)}` }}>
          {statItems.map((it, i) => (
            <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.15), borderLeft: i ? `${hair} solid ${hexA(gold, 0.45)}` : undefined, minWidth: 0 }}>
              <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(fit(it.value, S.facts * (social ? 1.7 : portrait ? 1.65 : 1.45), 5, 0.6)), lineHeight: 1, color: '#1B1A17', whiteSpace: 'nowrap' }}>{it.value}</span>
              <span style={{ ...caps, letterSpacing: '0.12em', fontSize: u(S.facts * (social ? 0.6 : portrait ? 0.58 : 0.52)), color: gold }}>{STAT[it.label] || it.label}</span>
            </div>
          ))}
        </Pick>
      )}
    </Pick>
  ) : null
  // top (cqmin) for a card whose band's angled end meets the slant: y(x) is the slant's top edge (% of the
  // height) at x (% of the width); hU = the canvas height in cqmin
  const onLine = (w: number, rightU: number, yAt: (x: number) => number, hU: number) => {
    const band = bandOf(w)
    const x = 100 - rightU - band.w
    return (yAt(x) / 100) * hU - band.h * 0.55
  }

  // the open house card (print): the month named once on the left; "Open / House" stacked when the days
  // fall in different months (user 10/10); one row per day, or the days joined when they share hours
  const ohCardFor = (narrow: boolean) => {
    if (!c.isPrint || !oh) return null
    const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim()
    const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 3)
    const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
    const rows = days.map((d, k) => {
      const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
      const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
      return { wd: wd.slice(0, 3), mon: m ? m[1].slice(0, 3) : '', day: m ? m[2] : rest, time: times.length > 1 ? times[k] ?? '' : '' }
    })
    const oneMonth = rows.every(r => r.mon && r.mon.toLowerCase() === rows[0].mon.toLowerCase())
    const shared = times.length <= 1 ? times[0] || '' : ''
    const label = (r: typeof rows[number]) => `${r.wd ? `${r.wd} ` : ''}${oneMonth ? '' : `${r.mon} `}${r.day}`.trim()
    const lines = shared ? [{ day: rows.map(label).join(' & '), time: '' }] : rows.map(r => ({ day: label(r), time: r.time }))
    const longest = Math.max(...lines.map(l => l.day.length + l.time.length * 0.85))
    // narrower card beside the scan card on a letter / flyer: the rows size down to fit it
    const k = Math.min(1, (narrow ? 15 : 17) / Math.max(10, longest))
    const monthBig = oneMonth && <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(S.facts * 2), lineHeight: 1, color: '#1B1A17', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rows[0].mon}</span>
    const dayRows = (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.35) }}>
        {lines.map(l => (
          <div key={l.day} style={{ display: 'flex', alignItems: 'baseline', gap: u(S.gap * 0.7), whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(S.facts * (rows.length === 1 ? 1.6 : 1.4) * k), lineHeight: 1.05, color: '#1B1A17', textTransform: 'uppercase' }}>{l.day}</span>
            {l.time && <span style={{ ...caps, color: hexA('#1B1A17', 0.75), letterSpacing: '0.06em', fontSize: u(S.facts * 0.82 * k) }}>{l.time}</span>}
          </div>
        ))}
        {shared && <span style={{ ...caps, color: gold, letterSpacing: '0.08em', fontSize: u(fit(shared, S.facts * 0.9, 16, 0.6)) }}>{shared}</span>}
      </div>
    )
    if (narrow) return (
      <Pick id={oh.id} sel={sel} style={{ alignSelf: 'stretch', filter: shadow, height: '100%' }}>
        <div style={{ background: gold, padding: hair, clipPath: cutTR, height: '100%', boxSizing: 'border-box' }}>
          <div style={{ background: '#FFFFFF', clipPath: cutTR, height: '100%', boxSizing: 'border-box', display: 'flex', gap: u(S.gap * 0.9), padding: `${u(S.gap * 0.85)} ${u(S.gap * 1.4)} ${u(S.gap * 0.85)} ${u(S.gap * 1.1)}` }}>
            <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * 0.45) }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: u(S.gap * 0.7) }}>
                <span style={{ ...caps, color: gold, letterSpacing: '0.2em', fontSize: u(S.facts * 0.62) }}>Open House</span>
                {monthBig}
              </div>
              <span aria-hidden style={{ height: hair, background: hexA(gold, 0.45) }} />
              {dayRows}
            </div>
          </div>
        </div>
      </Pick>
    )
    return (
      <Pick id={oh.id} sel={sel} style={{ alignSelf: 'stretch', filter: shadow }}>
        <div style={{ background: gold, padding: hair, clipPath: cutTR }}>
          <div style={{ background: '#FFFFFF', clipPath: cutTR, display: 'flex', alignItems: 'center', gap: u(S.gap * 1.1), padding: `${u(S.gap * 0.85)} ${u(S.gap * 1.6)} ${u(S.gap * 0.85)} ${u(S.gap * 1.3)}` }}>
            <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: u(S.gap * 0.15), flexShrink: 0 }}>
              {oneMonth
                ? <>
                    <span style={{ ...caps, color: gold, letterSpacing: '0.2em', fontSize: u(S.facts * 0.62) }}>Open House</span>
                    <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(S.facts * 2), lineHeight: 1, color: '#1B1A17', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rows[0].mon}</span>
                  </>
                : <span style={{ ...caps, color: gold, letterSpacing: '0.16em', fontSize: u(S.facts * 1.05), lineHeight: 1.1 }}>Open<br />House</span>}
            </div>
            <span aria-hidden style={{ alignSelf: 'stretch', width: hair, background: hexA(gold, 0.45), flexShrink: 0 }} />
            {dayRows}
          </div>
        </div>
      </Pick>
    )
  }
  const ohCard = ohCardFor(false)
  const ohStrip = (w: number) => {
    if (!c.isPrint || !oh) return null
    const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
    const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 3)
    const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
    const rows = days.map((d, k) => {
      const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
      const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
      return { day: `${wd ? `${wd.slice(0, 3)}, ` : ''}${m ? `${m[1].slice(0, 3)} ${m[2]}` : rest}`, time: times.length > 1 ? times[k] ?? '' : times[0] ?? '' }
    })
    const shared = rows.length > 1 && times.length <= 1
    const lines = shared ? [{ day: rows.map(r => r.day).join(' & '), time: rows[0].time }] : rows
    const tabW = S.facts * 4.3
    const room = w - tabW - S.gap * 2.6
    const longest = Math.max(...lines.map(l => l.day.length * 0.55 + l.time.length * 0.5))
    const k = Math.min(1, room / (longest * S.facts * 1.2))
    const two = lines.length > 1
    return (
      <Pick id={oh.id} sel={sel} style={{ alignSelf: 'stretch', filter: shadow }}>
        <div style={{ background: gold, padding: hair, clipPath: cutTR }}>
          <div style={{ background: '#FFFFFF', clipPath: cutTR, display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: `0 0 ${u(tabW)}`, background: gold, color: goldInk, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${u(S.gap * 0.7)} 0` }}>
              <span style={{ ...caps, letterSpacing: '0.16em', paddingLeft: '0.16em', fontSize: u(S.facts * 0.78), lineHeight: 1.25, textAlign: 'center' }}>Open<br />House</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * (two ? 0.35 : 0.2)), padding: `${u(S.gap * (two ? 0.75 : 0.9))} ${u(S.gap * 1.5)} ${u(S.gap * (two ? 0.75 : 0.9))} ${u(S.gap * 1.1)}` }}>
              {lines.map(l => two ? (
                <div key={l.day} style={{ display: 'flex', alignItems: 'baseline', gap: u(S.gap * 0.7), whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(S.facts * 1.45 * k), lineHeight: 1.1, color: '#1B1A17' }}>{l.day}</span>
                  {l.time && <span style={{ ...caps, color: gold, letterSpacing: '0.06em', fontSize: u(S.facts * 0.85 * k) }}>{l.time}</span>}
                </div>
              ) : (
                <div key={l.day} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.15), whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(S.facts * 1.75 * Math.min(1, room / (l.day.length * S.facts * 1.75 * 0.52))), lineHeight: 1.08, color: '#1B1A17' }}>{l.day}</span>
                  {l.time && <span style={{ ...caps, color: gold, letterSpacing: '0.1em', fontSize: u(S.facts * 0.95 * Math.min(1, room / (l.time.length * S.facts * 0.95 * 0.72))) }}>{l.time}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Pick>
    )
  }

  // header: kicker, the title-case serif headline (the street for listings, on one line when it fits),
  // the town, a short gold rule; then the paragraph in a tinted panel with a straight gold line
  const words = (align: 'left' | 'center', k: number, colW: number, opts: { story?: boolean; cta?: boolean } = {}) => {
    const S = k === 1 ? S1 : scaled(S1, k)
    const rule = <span aria-hidden data-rule="" style={{ display: 'block', width: u(14), height: u(0.5), background: gold, margin: `${u(S.gap * 0.35)} 0 ${u(S.gap * 0.25)}` }} />
    const panel = (child: ReactNode) => (
      <div style={{ display: 'flex', gap: u(S.gap * 0.9), background: hexA(gold, 0.1), padding: `${u(S.gap * 0.85)} ${u(S.gap * 1.2)} ${u(S.gap * 0.85)} ${u(S.gap * 0.9)}`, clipPath: 'polygon(0 0, calc(100% - 3cqmin) 0, 100% 3.4cqmin, 100% 100%, 0 100%)', alignSelf: 'stretch' }}>
        <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>{child}</div>
      </div>
    )
    const base = S.title * (c.leadGen ? (c.isPrint && (portrait || tall) ? 0.95 : c.isPrint && wide ? 0.8 : 0.66) : story ? 0.9 : 0.8)
    let head: ReactNode = null
    if (c.title?.isAddress) {
      const text = titleCase(c.title.text)
      const cw = t.styleId === 'bold' ? 0.46 : 0.5
      const raw = Math.min(base * 1.05, colW / (text.length * cw))
      // a narrow letter column (beside the QR tower): two big lines read better than one small one
      const narrowLetter = c.isPrint && portrait && colW < 50
      const fits = raw >= base * 0.55
      const size = fits ? Math.min(raw, narrowLetter ? raw : oh && c.isPrint && !portrait ? colW * 0.085 : colW * (portrait ? (oh ? 0.11 : 0.08) : 0.1)) : Math.min(base * 0.85, (colW * 1.9) / (text.length * cw))
      const socialFit = social
      head = narrowLetter || socialFit
        ? socialFit
          ? <FitLines text={text} size={base * (story ? 0.95 : oh || showPrice ? 1.4 : 1.75) * (c.title.o.k || 1)} lines={text.length > 24 ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.08, color: ink.ink, textAlign: align, letterSpacing: '-0.005em', opacity: c.title.placeholder ? 0.45 : 1, ...(text.length > 24 ? { textWrap: 'balance' as any } : {}), ...c.title.o.css }} />
          : <FitLines text={text} size={base * (oh ? 1.35 : 1.75) * (c.title.o.k || 1)} lines={text.length > 26 ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.08, color: ink.ink, textAlign: align, letterSpacing: '-0.005em', opacity: c.title.placeholder ? 0.45 : 1, ...(text.length > 26 ? { textWrap: 'balance' as any } : {}), ...c.title.o.css }} />
        : <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: u(size * (c.title.o.k || 1)), lineHeight: 1.08, color: ink.ink, textAlign: align, letterSpacing: '-0.005em', opacity: c.title.placeholder ? 0.45 : 1, ...(fits ? { whiteSpace: 'nowrap' } : { textWrap: 'balance' as any }), ...c.title.o.css }}>{text}</div>
    } else if (c.title && feed && c.leadGen) {
      const long = c.title.text.length > 34
      const tt = titleCase(c.title.text)
      const qm = tt.match(/^([\s\S]*?)([?.!]+)$/)
      head = <FitLines text={tt} node={qm ? <>{qm[1]}<span style={{ color: gold, fontStyle: 'italic' }}>{qm[2]}</span></> : tt} size={base * (story ? 1.3 : 1.6) * (c.title.o.k || 1)} lines={long ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.08, color: ink.ink, textAlign: align, letterSpacing: '-0.005em', opacity: c.title.placeholder ? 0.45 : 1, ...(long ? { textWrap: 'balance' as any } : {}), ...c.title.o.css }} />
    } else if (c.title) {
      const bigLetter = portrait && c.isPrint && c.leadGen
      head = <SerifHeadline text={c.title.text} t={t} ink={ink} size={base * (tall ? 0.78 : social ? (feed && c.leadGen ? 1.38 : 1.05) : bigLetter ? 0.78 : 0.95)} align={align} o={c.title.o} placeholder={c.title.placeholder} comfortable={c.isPrint ? (bigLetter ? 40 : (tall || wide) && c.title.text.length > 24 ? (wide ? 27 : 28) : 22) : feed && c.leadGen ? 60 : 26} accent={gold} />
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.55), minWidth: 0, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        {kick && <Pick id={kick.id} sel={sel} style={{ maxWidth: '100%' }}><div style={{ overflow: 'hidden' }}><Kicker text={kick.text} t={t} ink={ink} size={S.kicker * (portrait && c.isPrint && !c.leadGen ? 1.25 : 1)} align={align} o={kick.o} /></div></Pick>}
        {c.title && (
          <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.3), alignSelf: 'stretch' }}>
            {c.title.isAddress ? <div data-addr="">{head}</div> : head}
            {c.sub && c.title.isAddress && <FitLines text={c.sub.text} size={S.sub * 0.82} lines={1} style={{ fontFamily: t.fonts.label, fontWeight: t.label.weight, textTransform: 'uppercase', letterSpacing: t.label.tracking, lineHeight: 1.35, color: ink.muted, textAlign: align }} />}
          </Pick>
        )}
        {rule}
        {!showPrice && !c.leadGen && facts && <FactsLine c={c} t={t} ink={ink} size={S.facts * 1.1} sel={sel} weight={700} />}
        {c.sub && !c.title?.isAddress && panel(<Lede text={c.sub.text} t={t} ink={ink} size={S.body * (c.isPrint ? (portrait && c.leadGen ? 0.98 : wide && c.leadGen && (c.title?.text.length || 0) > 24 ? 1.1 : 0.92) : story && c.leadGen ? 1.05 : feed && c.leadGen ? 1.25 : 1.3)} align={align} style={{ display: '-webkit-box', WebkitLineClamp: social ? 3 : 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: social ? 1.35 : 1.5, ...(social ? { fontWeight: 600, color: ink.ink } : {}) }} />)}
        {opts.story && !c.leadGen && c.details.some(d => d.kind === 'description') && panel(<div style={{ overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['description']} clamp={social ? 3 : 2} /></div>)}
        {opts.cta && c.leadGen && !scanCard && !social && <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['cta']} />}
        {social && !c.leadGen && !showPrice && ctaPill}
      </div>
    )
  }
  const ctaPill = social && c.socialButton && (
    <Pick id={c.title?.id} sel={sel} style={{ alignSelf: 'flex-start' }}>
      <div style={{ background: gold, color: goldInk, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: u(S.facts * 0.55), padding: `${u(S.facts * 0.68)} ${u(S.facts * 1.35)}`, clipPath: 'polygon(0 0, calc(100% - 2.2cqmin) 0, 100% 2.5cqmin, 100% 100%, 0 100%)', boxShadow: '0 0.6cqmin 1.4cqmin rgba(0,0,0,0.18)' }}>
        <span style={{ ...caps, letterSpacing: '0.14em', fontSize: u(S.facts * 1.02) }}>{c.socialButton}</span>
        <svg viewBox="0 0 12 12" fill="none" stroke={goldInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(S.facts * 0.8), height: u(S.facts * 0.8) }}><path d="M4 2 L8.5 6 L4 10" /></svg>
      </div>
    </Pick>
  )
  const ctaCard = (w: number) => {
    if (!social || !c.leadGen || (!askCta && (story || !c.socialButton))) return null
    const btn = story ? null : c.socialButton // stories carry the button in the footer (the card keeps its spot)
    return (
      <Pick id={askCta?.id || c.title?.id} sel={sel} style={{ width: u(w), display: 'flex', alignItems: 'stretch', filter: 'drop-shadow(0 1cqmin 2.4cqmin rgba(0,0,0,0.3))' }}>
        {askCta && (
          <div style={{ flex: 1, minWidth: 0, background: gold, padding: `${hair} 0 ${hair} ${hair}`, clipPath: cutTL }}>
            <div style={{ background: '#FFFFFF', clipPath: cutTL, height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: u(S.gap * 0.8), padding: `${u(S.gap * (story ? (c.situation === 'social_ad' ? 1.2 : 1.15 * small) : feed ? 0.85 : 1.3))} ${u(S.gap * 1.1)} ${u(S.gap * (story ? (c.situation === 'social_ad' ? 1.2 : 1.15 * small) : feed ? 0.85 : 1.3))} ${u(S.gap * (story && c.situation !== 'social_ad' ? 1.4 : 1.8))}` }}>
              <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, paddingRight: feed ? u(2 - socialOut) : 0, maxWidth: feed && !story && askCta.label.length > 20 ? u(w * 0.6) : story && c.situation !== 'social_ad' ? u(S.facts * 2.6 * small * 6.4 + 2 - socialOut) : undefined }}><FitLines text={askCta.label} size={S.facts * (feed ? 2.6 * small : 2.35)} lines={feed ? (askCta.label.length > 20 || story ? 2 : 1) : 3} style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, lineHeight: 1.12, color: '#1B1A17', textWrap: 'balance' as any }} /></div>
            </div>
          </div>
        )}
        {btn && (
          <div style={{ flex: '0 0 auto', width: u(w * (askCta ? 0.27 : 1)), background: gold, color: goldInk, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(S.facts * 0.55), padding: `${u(S.gap)} ${u(S.gap * 0.5)}`, boxSizing: 'border-box' }}>
            {btn.split(/\s+/).map((wd, k) => <span key={k} style={{ ...caps, letterSpacing: '0.14em', fontSize: u(fit(wd, S.facts * 1.05, 6, 0.55)), lineHeight: 1.1 }}>{wd}</span>)}
            <svg viewBox="0 0 24 12" fill="none" stroke={goldInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(S.facts * 1.5), height: u(S.facts * 0.75), marginTop: u(S.facts * 0.15) }}><path d="M2 6 H21" /><path d="M16 1.5 L21 6 L16 10.5" /></svg>
          </div>
        )}
      </Pick>
    )
  }
  const agentOnly = { ...c, qr: scanCard ? null : c.qr, phonesInline: tall }
  const signOff = c.isPrint
    ? <PrintSignOff c={agentOnly} t={t} ink={ink} S={S} sel={sel} fam={fam} qrLabel={false} big={pcard ? 1.08 : 1} fineOneLine={pcard} />
    : (c.agent || c.logo) && (
      <div data-sign="" style={{ borderTop: `${hair} solid ${ink.rule}`, paddingTop: u(S.gap * 0.75), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} compact={wide} button={(story && c.leadGen) || (!c.leadGen && showPrice && fam === 'square' && (ar < 0.9 || !oh))} />
        {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const stack = (...items: ReactNode[]) => {
    const list = items.filter(Boolean)
    return list.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6), alignSelf: 'stretch' }}>{list}</div> : null
  }

  // ---- postcards
  if (wide) {
    const top = c.isPrint ? 58 : 52, bottom = c.isPrint ? 47 : 40 // the slab's right edge, % of the width, at the top and the bottom
    const colW = (bottom - 6) * 1.5
    return (
      <>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: gold, clipPath: `polygon(0 0, ${top + 1.6}% 0, ${bottom + 1.6}% 100%, 0 100%)` }} />
        <div style={{ position: 'absolute', inset: 0, background: T.strong, clipPath: `polygon(0 0, ${top}% 0, ${bottom}% 100%, 0 100%)` }} />
        <div style={{ position: 'absolute', left: u(P), top: u(P * 0.8), bottom: u(P * 0.7), width: `${bottom - 6}%`, display: 'flex', flexDirection: 'column', gap: u(S.gap), zIndex: 2 }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: c.leadGen ? 'center' : 'space-evenly', gap: u(S.gap) }}>
            {words('left', c.leadGen ? 1.42 : oh ? 1.42 : 1.55, colW, { cta: true })}
            {!c.leadGen && stack(ohCard, scanCardFor(colW))}
          </div>
          {signOff}
        </div>
        {scanOnPhoto && scanCard && <div style={{ position: 'absolute', right: u(P * 0.6), bottom: u(P * 0.9), width: u(62), zIndex: 3 }}>{scanCardFor(62)}</div>}
        {showPrice && <div style={{ position: 'absolute', right: u(P * 1.1), bottom: u(P * 0.9), zIndex: 3 }}>{priceCard(58)}</div>}
      </>
    )
  }

  // ---- door hangers + letter mailers / flyers: the photo above the slant, the price card on the
  // photo's lower right (or the scan card, on lead-gen pieces), the words and cards on the cream below
  if (tall || portrait) {
    const Hp = H
    const lt = 100 - Hp * 0.74
    const rt = 100 - Hp
    // letters with a price: the words column runs beside the price card + QR tower on the right
    const towerW = portrait && c.leadGen ? 44 : portrait ? 38 : 48
    const priceW = portrait && !c.leadGen ? 48 : towerW
    // open house letters / flyers: the calendar cards on the right beside the words, the scan card a wide
    // rectangle under them
    const ohLetter = portrait && !c.leadGen && !!oh
    const leadTower = portrait && c.leadGen && scanCard
    const sideBySide = portrait && (leadTower || (!c.leadGen && (showPrice || scanCard)))
    const colW = sideBySide ? 100 - P * 1.55 - (showPrice ? (priceW + towerW) / 2 : towerW) - S.gap * 1.6 : 100 - P * 2
    return (
      <>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, right: 0, top: tall ? '-8%' : 0, bottom: `${Hp * 0.7}%` }} />
        <div style={{ position: 'absolute', inset: 0, background: gold, clipPath: `polygon(0 ${lt - edge}%, 100% ${rt - edge}%, 100% 100%, 0 100%)` }} />
        <div style={{ position: 'absolute', inset: 0, background: T.strong, clipPath: `polygon(0 ${lt}%, 100% ${rt}%, 100% 100%, 0 100%)` }} />
        {tall && <div aria-hidden style={{ position: 'absolute', inset: u(P * 0.38), border: `${hair} solid ${hexA(gold, 0.7)}`, pointerEvents: 'none', zIndex: 4 }} />}
        {showPrice && (() => {
          const w = tall ? 70 : priceW
          const top = onLine(w, P * 0.55, x => lt - edge / 2 - (lt - rt) * x / 100, 100 / ar) - (tall ? 3 : 0)
          return (
            <div style={{ position: 'absolute', right: u(P * 0.55), top: u(top), zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: portrait ? 'flex-end' : 'center', gap: u(S.gap * (portrait ? 2 : 0.8)) }}>
              {priceCard(w)}
              {portrait && qrTower(towerW + 4, towerW * (ohLetter ? 0.74 : 0.58))}
            </div>
          )
        })()}
        {sideBySide && !showPrice && !leadTower && <div style={{ position: 'absolute', right: u(P * 0.55), top: `calc(${rt}% + ${u(S.gap * 1.3)})`, zIndex: 3 }}>{qrTower(towerW, towerW * 0.56)}</div>}
        {/* lead-gen: the scan card sits low, across the slant (hanger) / a square card in the open corner (letter) */}
        {scanOnPhoto && scanCard && !leadTower && (tall
          ? <div style={{ position: 'absolute', right: u(P * 0.8), bottom: `calc(${100 - lt}% + ${u(2)})`, width: `calc(100% - ${u(P * 1.6)})`, zIndex: 3 }}>{scanCardFor(100 - P * 1.6)}</div>
          : <div style={{ position: 'absolute', right: u(P * 0.8), bottom: `calc(${100 - lt}% + ${u(2)})`, width: u(64), zIndex: 3 }}>{scanCardFor(64)}</div>)}
        <div style={{ position: 'absolute', left: u(P), right: u(P), top: `calc(${lt}% + ${u(S.gap * 1.3)})`, bottom: u(P * (tall ? 0.75 : 0.7)), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap * 0.8), zIndex: 2 }}>
          {leadTower ? (() => {
            // the panel's top edge runs parallel to the slant, a little under it
            const hU = 100 / ar
            const yAt = (x: number) => ((lt - (lt - rt) * x / 100) / 100) * hU
            const x0 = 100 - P - towerW, x1 = 100 - P
            const g = S.gap * 1.8
            const colTop = (lt / 100) * hU + S.gap * 1.3
            const drop = yAt(x0) - yAt(x1)
            return (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(S.gap * 1.6) }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8) }}>{words('left', 1, colW, { story: false, cta: true })}</div>
                <div style={{ width: u(towerW), flexShrink: 0, marginTop: u(yAt(x1) + g - colTop), background: `linear-gradient(180deg, ${hexA(gold, 0.16)}, ${hexA(gold, 0.07)})`, clipPath: `polygon(0 ${u(drop)}, 100% 0, 100% 100%, 0 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${u(drop + S.gap * 0.4)} ${u(S.gap)} ${u(S.gap * 1.6)}`, boxSizing: 'border-box', position: 'relative' }}>
                  <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: u(0.55), background: gold }} />
                  {qrTower(towerW - S.gap * 2.4, towerW * 0.5, 0, 0.95)}
                </div>
              </div>
            )
          })() : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8), minHeight: 0, ...(tall ? { flex: 1, justifyContent: c.leadGen ? 'flex-start' : 'space-evenly', paddingTop: 0 } : {}), ...(sideBySide ? { width: u(colW) } : {}) }}>
            {false && ohLetter && oh ? (() => {
              const two = /&|\band\b/i.test(oh!.date)
              const cw = two ? 15 : 18
              const cardsW = two ? cw * 2.16 : cw
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: u(S.gap * 1.2) }}>
                  <div style={{ flex: 1, minWidth: 0 }}>{words('left', 1, colW - cardsW - S.gap * 1.2 - 2, { story: false, cta: true })}</div>
                  <div style={{ flexShrink: 0, paddingTop: u(1.5), paddingRight: u(1) }}><CalendarCards oh={oh!} t={t} sel={sel} fill={gold} fillInk={goldInk} w={cw} /></div>
                </div>
              )
            })() : words('left', tall ? 1.04 : 1, colW, { story: false, cta: true })}
            {!c.leadGen && (portrait ? (() => {
              const desc = c.details.some(d => d.kind === 'description')
              // open house letters / flyers (user 10/11): a short, wide open house card under the address, the
              // description (when there is one) under that
              const descPanel = desc && (
                <div style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: u(S.gap * 0.9), background: hexA(gold, 0.1), padding: `${u(S.gap * 0.85)} ${u(S.gap * 1.2)} ${u(S.gap * 0.85)} ${u(S.gap * 0.9)}`, clipPath: 'polygon(0 0, calc(100% - 3cqmin) 0, 100% 3.4cqmin, 100% 100%, 0 100%)' }}>
                  <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={sideBySide ? scaled(S, 1.08) : S} align="left" sel={sel} only={['description']} clamp={4} /></div>
                </div>
              )
              if (oh) return <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1), paddingTop: u(S.gap * 0.3) }}><div>{ohStrip(colW)}</div>{descPanel}</div>
              if (!desc) return null
              return (
                <div style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: u(S.gap * 0.9), background: hexA(gold, 0.1), padding: `${u(S.gap * 0.85)} ${u(S.gap * 1.2)} ${u(S.gap * 0.85)} ${u(S.gap * 0.9)}`, clipPath: 'polygon(0 0, calc(100% - 3cqmin) 0, 100% 3.4cqmin, 100% 100%, 0 100%)' }}>
                  <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={sideBySide ? scaled(S, 1.14) : S} align="left" sel={sel} only={['description']} clamp={sideBySide ? ((c.title?.text.length || 0) > 26 ? 6 : 7) : 4} /></div>
                </div>
              )
            })() : stack(ohCard, scanCardFor(colW)))}
          </div>
          )}
          {signOff}
        </div>
      </>
    )
  }

  // ---- social posts (square, 4:5, story): no QR - the price card at the slant's edge, the open house days
  // hanging from it as calendar cards (in the words on a story)
  const D = story ? 60 : feed ? 54 : 50
  const slantY = (x: number) => left - edge / 2 - (left - right) * x / 100
  const corner = false // (stories used to set the price card in the open corner; they now share the 4:5 design)
  const sq = fam === 'square' || story
  const storyCardW = story ? (c.situation === 'social_ad' ? 66 : 56) : feed ? 58 : 54
  const small = story && c.situation !== 'social_ad' ? 0.85 : 1 // the Find Your Dream Home story card, 15% smaller
  const socialOut = feed && !story && c.leadGen && c.socialButton ? 0 : story && c.situation === 'social_ad' ? -26 : story ? -16 : feed && c.situation === 'social_ad' ? -9 : -4 // how far the 4:5 lead-gen card runs off the right edge
  const ohHang = (w: number) => {
    if (!oh) return null
    const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
    const d = oh.date.split(/\s*(?:&|\band\b)\s*/i)[0] || oh.date
    const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
    const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
    const time = clean(oh.time.split(/\s*(?:&|\band\b|\/)\s*/i)[0] || oh.time)
    const lbl: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.1 }
    const cw = w * 2.35
    return (
      <Pick id={oh.id} sel={sel} style={{ position: 'relative', paddingTop: u(2.4) }}>
        {['20%', '80%'].map(x => <span key={x} aria-hidden style={{ position: 'absolute', left: x, top: 0, width: u(0.45), height: u(2.4 + w * 0.1), background: gold, transform: 'translateX(-50%)', borderRadius: u(0.3) }} />)}
        <div style={{ position: 'relative', width: u(cw), display: 'flex', alignItems: 'stretch', background: '#FFFDF8', borderRadius: u(w * 0.08), overflow: 'hidden', boxShadow: '0 0.9cqmin 2.2cqmin rgba(0,0,0,0.22)', transform: 'rotate(-1.5deg)' }}>
          <div style={{ flex: `0 0 ${u(w * 0.95)}`, background: gold, color: goldInk, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${u(w * 0.1)} 0` }}>
            {wd && <span style={{ ...lbl, fontSize: u(w * 0.13), letterSpacing: '0.12em', paddingLeft: '0.12em' }}>{wd.slice(0, 3)}</span>}
            <span style={{ fontFamily: t.fonts.display, fontWeight: 700, fontSize: u(w * 0.4), lineHeight: 1.05, margin: `${u(w * 0.03)} 0` }}>{m ? m[2] : rest}</span>
            {m && <span style={{ ...lbl, fontSize: u(w * 0.13), letterSpacing: '0.12em', paddingLeft: '0.12em' }}>{m[1].slice(0, 3)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(w * 0.06), padding: `${u(w * 0.1)} ${u(w * 0.1)}` }}>
            <span style={{ ...lbl, color: gold, fontSize: u(w * 0.13), letterSpacing: '0.2em', paddingLeft: '0.2em' }}>Open House</span>
            <span aria-hidden style={{ width: '62%', height: hair, background: hexA(gold, 0.5) }} />
            <span style={{ ...lbl, color: '#1B1A17', fontSize: u(fit(time, w * 0.21, 8, 0.5)), letterSpacing: '0.02em' }}>{time}</span>
          </div>
        </div>
      </Pick>
    )
  }
  const sqList = sq && showPrice && (!oh || story)
  const feedDesc = feed && !c.leadGen && c.details.some(d => d.kind === 'description') && (
    <div style={{ display: 'flex', gap: u(S.gap * 0.9), background: hexA(gold, 0.1), padding: `${u(S.gap * (story ? 0.75 : 0.9))} ${u(S.gap * 1.2)} ${u(S.gap * (story ? 0.75 : 0.9))} ${u(S.gap * 0.9)}`, clipPath: 'polygon(0 0, calc(100% - 3cqmin) 0, 100% 3.4cqmin, 100% 100%, 0 100%)' }}>
      <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.55), background: gold, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}><Details c={c} t={t} ink={ink} S={scaled(S, story ? 0.98 : 1.4)} align="left" sel={sel} only={['description']} clamp={story ? 4 : 3} /></div>
    </div>
  )
  const priceStack = (w = 0, joined = false) => showPrice && c.price ? (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: joined ? 0 : u(S.gap * 0.55) }}>
      <Pick id={c.price.id} sel={sel} style={{ filter: 'drop-shadow(0 0.8cqmin 2cqmin rgba(0,0,0,0.22))', marginTop: feed && !story ? u(-4) : 0, position: 'relative', zIndex: 2 }}>
        <div data-ptag="" style={{ background: joined ? '#1E1C19' : gold, color: joined ? '#FFFFFF' : goldInk, boxShadow: joined ? `inset 0 0 0 ${hair} ${hexA(gold, 0.9)}` : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.gap * (story ? 0.22 : 0.3)), padding: story ? `${u(S.gap * 0.8)} ${u(S.gap)} ${u(S.gap * 0.75)}` : `${u(S.gap * 1.15)} ${u(S.gap)} ${u(S.gap * 1.05)}`, clipPath: cutTL }}>
          <span style={{ ...caps, letterSpacing: '0.2em', paddingLeft: '0.2em', fontSize: u(S.facts * (story ? 0.62 : 0.7)), opacity: 0.92, color: joined ? gold : undefined }}>{c.price.label || (c.situation === 'price_improvement' ? 'Now' : c.situation === 'just_sold' ? 'Sold for' : 'Offered at')}</span>
          <span style={{ fontFamily: t.fonts.price, fontWeight: t.styleId === 'minimal' ? 800 : t.price.weight, fontSize: u(Math.min(fit(c.price.value, S.price * 1.18, 10, 0.6), w ? (w - S.gap * (story ? 4 : 2.4)) / (c.price.value.length * 0.54) : 99) * c.price.o.k), lineHeight: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
          {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.62), textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
        </div>
      </Pick>
      {statItems.length > 0 && (
        <>
          {!joined && <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.5), padding: `0 ${u(S.gap * 1.2)}` }}>
            <span style={{ flex: 1, height: hair, background: hexA(gold, 0.6) }} />
            <span style={{ width: u(1.1), height: u(1.1), background: gold, transform: 'rotate(45deg)' }} />
            <span style={{ flex: 1, height: hair, background: hexA(gold, 0.6) }} />
          </div>}
          <Pick id={facts?.id} sel={sel} style={{ flex: 1, background: '#FFFFFF', border: `${hair} solid ${hexA(gold, 0.9)}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', boxShadow: '0 0.8cqmin 2cqmin rgba(0,0,0,0.12)' }}>
            {statItems.map((it, i) => (
              <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(S.gap * 0.12), padding: `${u(S.gap * 0.45)} ${u(S.gap * 0.3)}`, borderLeft: i % 2 ? `${hair} solid ${hexA(gold, 0.45)}` : undefined, borderTop: i > 1 ? `${hair} solid ${hexA(gold, 0.45)}` : undefined, minWidth: 0 }}>
                <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(fit(it.value, S.facts * 1.7, 5, 0.6)), lineHeight: 1, color: '#1B1A17', whiteSpace: 'nowrap' }}>{it.value}</span>
                <span style={{ ...caps, letterSpacing: '0.12em', fontSize: u(S.facts * 0.58), color: gold }}>{STAT[it.label] || it.label}</span>
              </div>
            ))}
          </Pick>
        </>
      )}
    </div>
  ) : null
  // story price (user 10/12): a small tab in the card's own shape carries the words, centred on the card;
  // the card joins the stats with no divider. Listings: the card spans the 2x2 stats, both top corners
  // cut. Open houses: the stats run on one wide row and the card sits flush on its right end (square
  // top-right corner), white so it stands off the gold slant. Every stat is set at one size.
  const storyPrice = (pw: number, rowW: number, ohMode: boolean) => {
    if (!showPrice || !c.price) return null
    const label = c.price.label || (c.situation === 'price_improvement' ? 'Now' : c.situation === 'just_sold' ? 'Sold for' : 'Offered at')
    const ps = Math.min(S.price * 1.45, (pw - S.gap * 1.6) / (c.price.value.length * 0.6)) * c.price.o.k
    const cutX = 4, cutY = 4.5, tcx = 1.5, tcy = 1.7
    const corners = (x: number, y: number) => ohMode
      ? `polygon(${u(x)} 0, 100% 0, 100% 100%, 0 100%, 0 ${u(y)})`
      : `polygon(${u(x)} 0, calc(100% - ${u(x)}) 0, 100% ${u(y)}, 100% 100%, 0 100%, 0 ${u(y)})`
    const cardClip = corners(cutX, cutY)
    const tabClip = corners(tcx, tcy)
    const long = label.length > 10
    const track = long ? '0.12em' : '0.2em'
    const tfs = Math.min(S.facts * 0.72, (pw * 0.82 - S.gap * 2.2) / (label.length * (long ? 0.84 : 0.92)))
    const n = statItems.length
    const oneRow = ohMode
    const statSize = n ? (oneRow
      ? Math.min(S.facts * 1.7, ...statItems.map(it => (rowW / n - S.gap * 0.9) / (Math.max(3, it.value.length) * 0.5)))
      : Math.min(...statItems.map(it => fit(it.value, S.facts * 1.7, 5, 0.6)))) : 0
    return (
      <div style={{ width: u(rowW), display: 'flex', flexDirection: 'column', alignItems: ohMode ? 'flex-end' : 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: u(S.gap * 1.2) }}>
        {ohMode && ctaPill && <div style={{ marginBottom: u(S.gap * 0.6) }}>{ctaPill}</div>}
        <Pick id={c.price.id} sel={sel} style={{ width: u(pw), filter: 'drop-shadow(0 0.8cqmin 2cqmin rgba(0,0,0,0.22))', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: gold, padding: ohMode ? 0 : `${hair} ${hair} 0`, clipPath: tabClip, marginBottom: '-1px' }}>
            <div style={{ background: ohMode ? gold : '#FFFFFF', clipPath: tabClip, display: 'flex', justifyContent: 'center', padding: `${u(S.gap * 0.42)} ${u(S.gap * 1.1)} ${u(S.gap * 0.36)}` }}>
              <span style={{ ...caps, color: ohMode ? goldInk : gold, letterSpacing: track, paddingLeft: track, fontSize: u(tfs), lineHeight: 1 }}>{label}</span>
            </div>
          </div>
          <div style={{ alignSelf: 'stretch', background: gold, padding: ohMode ? `${hair} ${hair} 0` : 0, clipPath: cardClip }}>
            <div data-ptag="" style={{ background: ohMode ? '#FFFFFF' : gold, color: ohMode ? '#1B1A17' : goldInk, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.gap * 0.2), padding: `${u(S.gap * 0.7)} ${u(S.gap * 0.6)} ${u(S.gap * 0.6)}`, clipPath: cardClip }}>
              <span style={{ fontFamily: t.fonts.price, fontWeight: 700, fontSize: u(ps), lineHeight: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
              {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.62), textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
            </div>
          </div>
        </Pick>
        </div>
        {n > 0 && (
          <Pick id={facts?.id} sel={sel} style={{ alignSelf: 'stretch', background: '#FFFFFF', border: `${hair} solid ${hexA(gold, 0.9)}`, display: 'grid', gridTemplateColumns: oneRow ? `repeat(${n}, 1fr)` : '1fr 1fr', gridAutoRows: '1fr', boxShadow: '0 0.8cqmin 2cqmin rgba(0,0,0,0.12)' }}>
            {statItems.map((it, i) => (
              <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(S.gap * 0.12), padding: `${u(S.gap * (oneRow ? 0.6 : 0.45))} ${u(S.gap * 0.2)}`, borderLeft: (oneRow ? i : i % 2) ? `${hair} solid ${hexA(gold, 0.45)}` : undefined, borderTop: !oneRow && i > 1 ? `${hair} solid ${hexA(gold, 0.45)}` : undefined, minWidth: 0 }}>
                <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(statSize), lineHeight: 1, color: '#1B1A17', whiteSpace: 'nowrap' }}>{it.value}</span>
                <span style={{ ...caps, letterSpacing: '0.12em', fontSize: u(S.facts * 0.58), color: gold }}>{STAT[it.label] || it.label}</span>
              </div>
            ))}
          </Pick>
        )}
        {!ohMode && ctaPill && <div style={{ alignSelf: 'flex-end', marginTop: u(S.gap * 0.8) }}>{ctaPill}</div>}
      </div>
    )
  }
  return (
    <>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: `${H * 0.7}%` }} />
      <div style={{ position: 'absolute', inset: 0, background: gold, clipPath: `polygon(0 ${left - edge}%, 100% ${right - edge}%, 100% 100%, 0 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: T.strong, clipPath: `polygon(0 ${left}%, 100% ${right}%, 100% 100%, 0 100%)` }} />
      {corner && (
        <div style={{ position: 'absolute', right: u(P * 0.9), top: u(onLine(D, P * 0.9, slantY, 100 / ar)), zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>{priceCard(D)}</div>
          {(ctaPill || (feed && oh)) && (
            <div style={{ alignSelf: ctaPill ? 'flex-end' : 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {ctaPill && <div style={{ position: 'relative', zIndex: 2, marginTop: u(S.gap * 0.7) }}>{ctaPill}</div>}
              {feed && oh && <div style={{ position: 'relative', zIndex: 1, marginTop: u(-0.4) }}><CalendarCards oh={oh} t={t} sel={sel} fill={gold} fillInk={goldInk} w={16} cord={2.4} /></div>}
            </div>
          )}
        </div>
      )}
      {showPrice && !corner && !sqList && (
        <div style={{ position: 'absolute', right: u(P * 0.9), top: u(onLine(D, P * 0.9, slantY, 100 / ar) - (oh ? (feed ? 1 : sq ? 7 : 8) : 0)), zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-start', gap: u(S.gap * 1.2) }}>{oh && fam === 'square' && !feed && ctaPill && <div style={{ marginTop: u(S.gap * 0.4) }}>{ctaPill}</div>}{priceCard(D)}</div>
          {oh && <div style={{ position: 'relative', zIndex: 1, marginTop: u(-0.4), ...(/&|\band\b/i.test(oh.date) ? { alignSelf: 'flex-end', paddingRight: u(feed ? 0.6 : 7) } : sq ? { alignSelf: 'flex-end', paddingRight: u(0.6) } : {}) }}>{(/&|\band\b/i.test(oh.date)
            ? <MatchAddressBottom target="[data-rule]" base={15} min={10} max={17} render={w => <CalendarCards oh={oh} t={t} sel={sel} fill={gold} fillInk={goldInk} w={w} cord={2.4} spread={0.42} />} />
            : <MatchAddressBottom target="[data-rule]" base={13} min={8} max={16.5} render={w => ohHang(w)} />)}</div>}
        </div>
      )}
      {c.leadGen && <div style={{ position: 'absolute', right: feed ? u(socialOut) : 0, ...(story ? { top: `calc(${left - (left - right) * ((100 - storyCardW - socialOut) / 100)}% + ${u(1.4)})` } : feed ? { top: `calc(${left - (left - right) * ((58 + socialOut) / 100)}% + ${u(story && c.situation !== 'social_ad' ? 3 : 0)})` } : { top: `calc(${right}% - ${u(story ? 2 : 3)})` }), zIndex: 3 }}>{ctaCard(storyCardW)}</div>}
      <div style={{ position: 'absolute', left: u(P), right: u(P), top: u(Math.max((left / 100) * (100 / ar) + S.gap * (flatStory ? 0.95 : 1.2) + (feed && c.leadGen ? 0.5 : 0), corner && !(feed && oh) ? onLine(D, P * 0.9, slantY, 100 / ar) + bandOf(D).h + S.facts * 3.4 + S.gap * 2.4 + (ctaPill ? S.facts * 2.4 + S.gap * 0.7 : 0) : 0)), bottom: story ? '10cqh' : u(P * 0.7), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap), zIndex: 2 }}>
        {(() => {
          const frac = showPrice && !corner ? (oh ? 0.48 : 0.62) : feed && oh && showPrice ? 0.5 : 1
          // story open house: the calendar cards sit bottom right, on a line with the address + town
          if (story && corner && oh) {
            const cw = /&|\band\b/i.test(oh.date) ? 16 : 21
            const cardsW = /&|\band\b/i.test(oh.date) ? cw * 2.16 : cw
            return (
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: u(S.gap) }}>
                <div style={{ flex: 1, minWidth: 0 }}>{words('left', 1, 100 - P * 2 - cardsW - S.gap - 3, { cta: true })}</div>
                <div style={{ flexShrink: 0, paddingRight: u(1), paddingBottom: u(S.gap * 0.6) }}><CalendarCards oh={oh} t={t} sel={sel} fill={gold} fillInk={goldInk} w={cw} /></div>
              </div>
            )
          }
          if (sqList && story) {
            const twoDays = !!oh && /&|\band\b/i.test(oh.date)
            const cw = 100 - P * 2
            const pw = cw * 0.4
            if (!oh) return (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                <div style={{ position: 'relative', paddingRight: u(pw + S.gap * 1.6) }}>
                  {words('left', 1, cw - pw - S.gap * 1.6, { cta: true })}
                  <div style={{ position: 'absolute', right: 0, bottom: 0, zIndex: 2 }}>{storyPrice(pw, pw, false)}</div>
                </div>
                {feedDesc && <div data-desc="" style={{ marginTop: u(S.gap * 1.1) }}>{feedDesc}</div>}
              </div>
            )
            const opw = cw * 0.45
            const rowW = cw * 0.68
            const cardW = twoDays ? opw / 2.4 : opw / 2.3
            const hangW = cardW * 2.35
            const shift = P * 0.45 // the whole group nudged toward the right edge
            const lift = twoDays ? 2.6 : 0 // two days: the group a little higher
            // two days: the cards start a little past the middle, clear of the address
            const colW = cw - opw - S.gap * 1.6 + shift
            return (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                <div style={{ position: 'relative', paddingRight: u(cw - colW) }}>
                  {words('left', 1, colW, { cta: true })}
                  <div style={{ position: 'absolute', right: u(-shift), bottom: `calc(100% + ${u(S.gap * 0.9 + lift)})`, zIndex: 2 }}>{storyPrice(opw, rowW, true)}</div>
                  <div style={{ position: 'absolute', top: u(-S.gap * 0.9 - lift - 0.4), zIndex: 1, ...(twoDays ? { right: u(-shift), width: u(opw), display: 'flex', justifyContent: 'center' } : { right: u((opw - hangW) / 2 - shift) }) }}>
                    {twoDays ? <CalendarCards oh={oh} t={t} sel={sel} fill={gold} fillInk={goldInk} w={cardW} cord={2.4} /> : ohHang(cardW)}
                  </div>
                </div>
                {feedDesc && <div data-desc="" style={{ marginTop: u(S.gap * 1.1) }}>{feedDesc}</div>}
              </div>
            )
          }
          if (sqList) {
            const stackW = (100 - P * 2) * 0.4
            return (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: u(S.gap * 1.6) }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>{words('left', 1, 100 - P * 2 - stackW - S.gap * 1.6, { cta: true })}</div>
                  <div style={{ width: u(stackW), flexShrink: 0, display: 'flex', flexDirection: 'column' }}>{priceStack()}</div>
                </div>
                {feedDesc && <div style={{ marginTop: u(S.gap * 1.2) }}>{feedDesc}</div>}
              </div>
            )
          }
          if (sq && showPrice && oh) return (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: u(S.gap * 1.2) }}>
              <div style={{ maxWidth: `${frac * 100}%`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
                {words('left', 1, (100 - P * 2) * frac, { cta: true })}
              </div>
              {feedDesc}
            </div>
          )
          return (
            <div style={{ maxWidth: `${frac * 100}%`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
              {words('left', 1, (100 - P * 2) * frac, { cta: true, story: corner && !oh })}
            </div>
          )
        })()}
        {signOff}
      </div>
    </>
  )
}

// ── Postage: the home as a perforated postage stamp, franked with a postmark - "Greetings from"
// the town, an airmail border. Made for the mailbox; just as charming in a feed.
function Stamp({ c, t, sel, width, rotate, paper, ratio = 0.8 }: { c: Content; t: DesignTheme; sel: Sel; width: number; rotate: number; paper: string; ratio?: number }) {
  const d = Math.max(1.6, width * 0.05)
  const r = d * 0.34
  const dots = (dir: 'x' | 'y') => `radial-gradient(circle at 50% 50%, ${paper} ${r}cqmin, transparent ${r + 0.06}cqmin) 0 0 / ${u(d)} ${u(d)} repeat-${dir}`
  const edge = (pos: CSSProperties, dir: 'x' | 'y') => <span aria-hidden style={{ position: 'absolute', background: dots(dir), ...pos }} />
  return (
    <div style={{ position: 'relative', width: u(width), flexShrink: 0, transform: `rotate(${rotate}deg)`, background: '#FFFDF8', padding: u(width * 0.065), boxShadow: '0 0.6cqmin 1.6cqmin rgba(0,0,0,0.18)' }}>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'relative', width: '100%', aspectRatio: `1 / ${ratio}` }} />
      {edge({ left: 0, right: 0, top: u(-d / 2), height: u(d) }, 'x')}
      {edge({ left: 0, right: 0, bottom: u(-d / 2), height: u(d) }, 'x')}
      {edge({ top: 0, bottom: 0, left: u(-d / 2), width: u(d) }, 'y')}
      {edge({ top: 0, bottom: 0, right: u(-d / 2), width: u(d) }, 'y')}
    </div>
  )
}

// Postage door hanger, open house (user 10/09): "Open House", the day, the date and the time as a
// little stamp of its own on the photo's top-right corner, instead of separate lines under the town.
function OpenHouseStamp({ oh, t, sel, width, paper, fill, ink: fg }: { oh: Extract<DetailItem, { kind: 'openHouse' }>; t: DesignTheme; sel: Sel; width: number; paper: string; fill: string; ink: string }) {
  const d = Math.max(1.4, width * 0.085)
  const r = d * 0.34
  const dots = (dir: 'x' | 'y') => `radial-gradient(circle at 50% 50%, ${paper} ${r}cqmin, transparent ${r + 0.06}cqmin) 0 0 / ${u(d)} ${u(d)} repeat-${dir}`
  const edge = (pos: CSSProperties, dir: 'x' | 'y') => <span aria-hidden style={{ position: 'absolute', background: dots(dir), ...pos }} />
  // "Sunday, October 12" -> SUNDAY / OCT 12; a two-day open house -> "SAT · NOV 22" and "SUN · NOV 23" stacked
  const short3 = (w: string) => w.replace(/^([A-Za-z]{3})[A-Za-z]*\.?/, '$1')
  const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean)
  const multi = days.length > 1
  const [weekday, rest] = !multi && oh.date.includes(',') ? [oh.date.split(',')[0].trim(), oh.date.split(',').slice(1).join(',').trim()] : ['', oh.date]
  const day = short3(rest)
  const dayLines = multi ? days.map(d => (d.includes(',') ? `${short3(d.split(',')[0].trim())} · ${short3(d.split(',').slice(1).join(',').trim())}` : short3(d))) : []
  const time = oh.time.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim()
  // two days, each with its own hours: each day line gets its time right under it
  const times = time.split(/\s*(?:&|\band\b|\/)\s*/i).filter(Boolean)
  const perDay = multi && dayLines.length === 2 && times.length === 2
  const label: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.1, whiteSpace: 'nowrap' }
  return (
    <Pick id={oh.id} sel={sel} style={{ position: 'relative', width: u(width), background: paper, padding: u(width * 0.07), boxShadow: '0 0.7cqmin 1.8cqmin rgba(0,0,0,0.28)' }}>
      <div style={{ background: fill, color: fg, padding: `${u(width * 0.1)} ${u(width * 0.06)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(width * 0.035), textAlign: 'center', outline: `${hair} solid ${hexA(fg, 0.5)}`, outlineOffset: u(-width * 0.035) }}>
        {weekday && <span style={{ ...label, fontSize: u(fit(weekday, width * 0.115, 7, 0.7)), letterSpacing: '0.16em', paddingLeft: '0.16em', opacity: 0.92 }}>{weekday}</span>}
        {perDay
          ? dayLines.map((l, i) => (
              <span key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(width * 0.012), marginTop: i ? u(width * 0.03) : 0 }}>
                <span style={{ ...label, fontSize: u(fit(l, width * 0.11, 11, 0.55)), letterSpacing: '0.04em' }}>{l}</span>
                <span style={{ ...label, fontSize: u(fit(times[i], width * 0.097, 12, 0.5)), letterSpacing: '0.02em', opacity: 0.92 }}>{times[i]}</span>
              </span>
            ))
          : multi
          ? dayLines.map(l => <span key={l} style={{ ...label, fontSize: u(fit(l, width * 0.11, 11, 0.55)), letterSpacing: '0.04em' }}>{l}</span>)
          : <span style={{ fontFamily: t.fonts.display, fontWeight: 700, fontSize: u(fit(day, width * 0.24, 6, 0.6)), lineHeight: 1, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{day}</span>}
        {time && !perDay && <span aria-hidden style={{ width: '62%', height: hair, background: hexA(fg, 0.55), margin: `${u(width * 0.02)} 0` }} />}
        {/* any range fits on one line: "1-3 PM", "3:30-5:30 PM", "11 AM-1 PM", "12:30-2:30 PM" */}
        {time && !perDay && <span style={{ ...label, fontSize: u(fit(time, width * 0.13, 8, 0.5)), letterSpacing: '0.04em' }}>{time}</span>}
      </div>
      {edge({ left: 0, right: 0, top: u(-d / 2), height: u(d) }, 'x')}
      {edge({ left: 0, right: 0, bottom: u(-d / 2), height: u(d) }, 'x')}
      {edge({ top: 0, bottom: 0, left: u(-d / 2), width: u(d) }, 'y')}
      {edge({ top: 0, bottom: 0, right: u(-d / 2), width: u(d) }, 'y')}
    </Pick>
  )
}

// The listing's news as a bold seal on the photo (user 10/09): "JUST / SOLD", "COMING / SOON"... - so
// the status chip above the address goes away. A solid accent disc, white rings, the last word big.
function KeepsakeSticker({ news, size, gold }: { news: string; size: number; gold: string }) {
  const words = news.trim().split(/\s+/)
  const KEY = ['sold', 'soon', 'new', 'listed', 'contract', 'pending', 'reduced', 'house']
  const ki = Math.max(0, words.findIndex(w => KEY.includes(w.toLowerCase().replace(/[^a-z]/g, ''))) >= 0 ? words.findIndex(w => KEY.includes(w.toLowerCase().replace(/[^a-z]/g, ''))) : words.length - 1)
  const key = words[ki].toLowerCase().replace(/[^a-z]/g, '')
  // one word only on the sticker (user 10/11): Open House -> Open, Under Contract -> Pending
  const ONE: Record<string, string> = { house: 'open', contract: 'pending' }
  const big = (ONE[key] || words[ki].toLowerCase()).replace(/^./, ch => ch.toUpperCase())
  const N = 18, r0 = 45.5, rc = 52.5
  let d = ''
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2
    const pt = (a: number, rr: number) => `${(50 + rr * Math.cos(a)).toFixed(2)} ${(50 + rr * Math.sin(a)).toFixed(2)}`
    d += (k ? '' : `M ${pt(a0, r0)} `) + `Q ${pt(am, rc)} ${pt(a1, r0)} `
  }
  const bigFs = Math.min(29, 58 / (Math.max(3, big.length) * 0.46))
  const lean = bigFs * 0.08 // the script leans right (its ascenders sit right of centre)
  return (
    <svg viewBox="0 0 100 100" aria-hidden style={{ display: 'block', width: u(size), height: u(size), overflow: 'visible', filter: 'drop-shadow(0 0.8cqmin 1.6cqmin rgba(0,0,0,0.28))' }}>
      <path d={d + 'Z'} fill="#FFFDF8" stroke={gold} strokeWidth="1.2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={gold} strokeWidth="1.8" />
      <circle cx="50" cy="50" r="36" fill="none" stroke={gold} strokeWidth="0.7" strokeDasharray="2 1.8" opacity="0.85" />
      <text x={50 - lean} y={50 + bigFs * 0.36} textAnchor="middle" fill="#2B2824" style={{ fontFamily: DESIGN_FONTS.script, fontSize: bigFs }}>{big}</text>
    </svg>
  )
}

function StatusSeal({ news, size, fill, fg }: { news: string; size: number; fill: string; fg: string }) {
  const words = news.trim().toUpperCase().split(/\s+/)
  const big = words.length > 1 ? words[words.length - 1] : words[0]
  const small = words.length > 1 ? words.slice(0, -1).join(' ') : ''
  // inner ring is ~70 units wide: Georgia caps run ~0.72em per letter, the small sans ~0.8em with tracking
  const bigFs = Math.min(22, 58 / (Math.max(3, big.length) * 0.72))
  const smallFs = Math.min(10, 46 / (Math.max(3, small.length) * 0.82))
  return (
    <svg viewBox="0 0 100 100" aria-hidden style={{ display: 'block', width: u(size), height: u(size), overflow: 'visible', filter: 'drop-shadow(0 0.9cqmin 1.8cqmin rgba(0,0,0,0.32))' }}>
      <circle cx="50" cy="50" r="48" fill={fill} />
      <circle cx="50" cy="50" r="43" fill="none" stroke={fg} strokeWidth="1.6" />
      <circle cx="50" cy="50" r="38.5" fill="none" stroke={fg} strokeWidth="0.8" strokeDasharray="2.2 2" opacity="0.8" />
      {small && <text x="50" y={50 - bigFs * 0.32} textAnchor="middle" fill={fg} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 800, fontSize: smallFs, letterSpacing: 1.6 }}>{small}</text>}
      <text x="50" y={small ? 50 + bigFs * 0.62 : 50 + bigFs * 0.36} textAnchor="middle" fill={fg} style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: bigFs }}>{big}</text>
    </svg>
  )
}

function Postmark({ size, color, ring, center, sub }: { size: number; color: string; ring: string; center: string; sub: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const rim = `${ring}  •  `.repeat(Math.max(1, Math.floor(46 / Math.max(8, ring.length + 5)))).toUpperCase()
  return (
    <svg viewBox="0 0 230 100" style={{ display: 'block', width: u(size * 2.3), height: u(size), overflow: 'visible', opacity: 0.86, filter: 'drop-shadow(0 0 0.35cqmin rgba(255,255,255,0.9)) drop-shadow(0 0 0.8cqmin rgba(255,255,255,0.45))' }}>
      <defs><path id={`pm${id}`} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" /></defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2.2" />
      <circle cx="50" cy="50" r="27" fill="none" stroke={color} strokeWidth="1.4" />
      <text fill={color} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: Math.min(9, 210 / Math.max(10, rim.length)), letterSpacing: 1.2 }}>
        <textPath href={`#pm${id}`}>{rim}</textPath>
      </text>
      {center.includes('\n') ? (
        <>
          {center.split('\n').map((line, i) => <text key={i} x="50" y={44 + i * 12} textAnchor="middle" fill={color} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 800, fontSize: 11.5, letterSpacing: 0.6 }}>{line.toUpperCase()}</text>)}
          <text x="50" y="68" textAnchor="middle" fill={color} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: 6 }}>{sub.toUpperCase()}</text>
        </>
      ) : (
        <>
          <text x="50" y="49" textAnchor="middle" fill={color} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 800, fontSize: Math.min(11, 48 / Math.max(4, center.length) * 1.7) }}>{center.toUpperCase()}</text>
          <text x="50" y="62" textAnchor="middle" fill={color} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: 7.5 }}>{sub.toUpperCase()}</text>
        </>
      )}
      {[0, 1, 2, 3, 4].map(i => (
        <path key={i} d={`M100,${30 + i * 10} q 8,-5 16,0 t 16,0 t 16,0 t 16,0 t 16,0 t 16,0 t 16,0 t 16,0`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  )
}

function Postage({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  // 4:5 feed post: photo on top, words under it, like the story (user 10/09: less dead space)
  const feed = fam === 'square' && ar < 0.9
  const story = fam === 'story'
  const tall = fam === 'tall'
  const portrait = fam === 'portrait'
  const wide = fam === 'landscape' || fam === 'banner'
  const S = wide ? scaled(S0, c.isPrint ? 0.8 : 0.86) : S0
  const P = S.pad
  const ink = inkOnBg(t)
  const paper = t.isDark ? t.bg : t.surface
  const accent = t.isDark ? t.photoAccent : t.accent
  const town = c.leadGen ? '' : (c.townOnly ? (c.title?.text || '') : placeName(c))
  const news = newsWord(c)
  const facts = findFacts(c)
  const oh = findOpenHouse(c)
  const now = new Date()
  const stampDate = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const band = wide ? 2.6 : 2.2
  const centered = story || tall || portrait || feed
  const align: 'left' | 'center' = centered ? 'center' : 'left'

  // Every format carries what the door hanger review settled (user 10/09: "keep all features the
  // same"): the gold price box, the striped rule + accent street, the open-house mini stamp and the
  // OPEN HOUSE postmark, title-case serif headlines, and the ask as a scan prompt right above the QR.
  const bandInk: Ink = { ...ink, ink: t.isDark ? '#15161A' : '#FFFFFF', muted: t.isDark ? 'rgba(21,22,26,0.75)' : 'rgba(255,255,255,0.82)', accent: t.isDark ? '#15161A' : '#FFFFFF' }
  const askCta = c.leadGen ? (c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined) : undefined
  // Listing pieces say why to scan too (user 10/09: "showing you why you wanna scan").
  const listingAsk = !c.leadGen && c.qr ? (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo') : ''
  // With a QR: above the footer, the arrow on the QR's side (bottom-left on hangers, bottom-right on
  // mailers). Without one (social): the same italic ask in place, no arrow.
  const qrArrow: 'left' | 'right' = tall ? 'left' : 'right'
  // the arrow's tip lands over the QR's middle, not past its right edge
  const scanPrompt = c.qr && (askCta || listingAsk) && (
    <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ display: 'flex', justifyContent: qrArrow === 'left' ? 'center' : 'flex-end', width: '100%', marginBottom: u(S.gap * (tall ? 0.3 : 0.6)), paddingRight: qrArrow === 'right' ? u(S.qr * (c.isPrint ? 0.3 : 0)) : 0 }}>
      <ScanPrompt label={askCta?.label || listingAsk} sub={c.qr.label || undefined} t={t} ink={ink} size={S.facts * (wide ? 1.15 : 1)} accent={accent} o={askCta?.o} arrow={qrArrow} />
    </Pick>
  )
  const ohStamp = (w: number) => oh && <OpenHouseStamp oh={oh} t={t} sel={sel} width={w * (/&|\band\b/i.test(oh.date) && /&|\band\b|\//i.test(oh.time) ? 0.46 : /&|\band\b/i.test(oh.date) || oh.time.replace(/:00/g, '').replace(/\s+/g, '').length > 8 ? 0.4 : 0.33)} paper="#FFFDF8" fill={accent} ink={t.isDark ? '#15161A' : '#FFFFFF'} />
  // the photo stamp with its postmark - and, for an open house, the mini date stamp top-right
  const framed = (w: number, rotate: number, ratio?: number) => (
    <div style={{ position: 'relative' }}>
      <Stamp c={c} t={t} sel={sel} width={w} rotate={rotate} paper={paper} ratio={ratio} />
      {oh ? (
        <>
          <div style={{ position: 'absolute', left: u(-w * 0.09), top: u(-w * 0.1), transform: 'rotate(-10deg)', pointerEvents: 'none', zIndex: 1 }}>{mark(w * 0.25)}</div>
          <div style={{ position: 'absolute', right: u(-w * 0.07), top: u(-w * 0.11), transform: 'rotate(6deg)', zIndex: 2 }}>{ohStamp(w)}</div>
        </>
      ) : !c.leadGen && news ? (
        <div style={{ position: 'absolute', left: u(-w * 0.1), top: u(-w * 0.12), transform: 'rotate(-12deg)', pointerEvents: 'none', zIndex: 2 }}>
          <Pick id={c.big?.id || c.kicker?.id} sel={sel}><StatusSeal news={news} size={w * 0.34} fill={accent} fg={t.isDark ? '#15161A' : '#FFFFFF'} /></Pick>
        </div>
      ) : (
        <div style={{ position: 'absolute', right: u(-w * (tall || story ? 0.1 : pcard ? 0.08 : 0.3)), top: u(-w * 0.06), transform: 'rotate(-12deg)', pointerEvents: 'none' }}>{mark(w * (tall || story ? 0.32 : pcard ? 0.3 : 0.36))}</div>
      )}
    </div>
  )
  // postcards: address, price and stats move under the photo on a card tilted with it
  const split = false // tilted info card under the photo - tried 10/09, user preferred the box on the left
  // Postcard listings (user 10/09): price + every stat (acres too) in a panel tucked into the
  // bottom-right, hugging the right border - the left side keeps the greeting, the ask and a bigger footer.
  const pcard = wide && c.isPrint // every printed postcard: own scan section, agent-only footer
  const panel = pcard && !c.leadGen && (!!c.price || !!facts)
  const statItems = [...(facts?.items || []).filter(i => i.key !== 'property_type'), ...(c.lot && !(facts?.items || []).some(i => i.key === 'lot_size') ? [c.lot] : [])]
  const STAT_LABEL: Record<string, string> = { Beds: 'Beds', Bed: 'Bed', Baths: 'Baths', Bath: 'Bath', 'Sq Ft': 'Sq Ft', Acres: 'Acres', 'Sq Ft Lot': 'Lot Sq Ft', Built: 'Built' }
  const statsPanel = (w: number) => {
    const gold = accent
    return (
      <div style={{ width: u(w), background: '#FFFDF8', boxShadow: '0 0.7cqmin 1.8cqmin rgba(0,0,0,0.12)', padding: u(1.1), boxSizing: 'border-box', transform: 'rotate(-1.2deg)' }}>
        <div style={{ border: `${hair} solid ${hexA(gold, 0.85)}`, outline: `${hair} solid ${hexA(gold, 0.45)}`, outlineOffset: u(-0.9), padding: `${u(S.gap * 0.9)} ${u(S.gap * 0.8)} ${u(S.gap * 0.8)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.45) }}>
          {c.price && (
            <Pick id={c.price.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.2) }}>
              <span style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.24em', paddingLeft: '0.24em', fontSize: u(S.facts * 0.6), color: gold, whiteSpace: 'nowrap' }}>{c.price.label || 'Offered at'}</span>
              <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, fontSize: u(fit(c.price.value, S.price * 1.05, 10, 0.6)), lineHeight: 1, color: '#1B1A17', whiteSpace: 'nowrap' }}>{c.price.value}</span>
            </Pick>
          )}
          {c.price && statItems.length > 0 && (
            <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.5), width: '70%' }}>
              <span style={{ flex: 1, height: hair, background: hexA(gold, 0.6) }} />
              <span style={{ width: u(1.1), height: u(1.1), background: gold, transform: 'rotate(45deg)' }} />
              <span style={{ flex: 1, height: hair, background: hexA(gold, 0.6) }} />
            </div>
          )}
          {statItems.length > 0 && (
            <Pick id={facts?.id} sel={sel} style={{ display: 'grid', gridTemplateColumns: `repeat(${statItems.length}, 1fr)`, width: '100%' }}>
              {statItems.map((it, i) => (
                <div key={it.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.15), borderLeft: i ? `${hair} solid ${hexA(gold, 0.35)}` : undefined, minWidth: 0 }}>
                  <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(fit(it.value, S.facts * 1.55, 5, 0.6)), lineHeight: 1, color: '#1B1A17', whiteSpace: 'nowrap' }}>{it.value}</span>
                  <span style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(S.facts * 0.5), color: gold, whiteSpace: 'nowrap' }}>{STAT_LABEL[it.label] || it.label}</span>
                </div>
              ))}
            </Pick>
          )}
        </div>
      </div>
    )
  }
  // postcards (user 10/09: "much more stunning"): an airmail card - striped edge like the frame, the ask in
  // italic serif, the scan line in caps, a drawn arrow, and the QR presented as a perforated stamp.
  const scanAsk = askCta?.label || listingAsk
  const scanSection = pcard && c.qr && scanAsk && (() => {
    const qs = S.qr * (panel ? 1.4 : 1.32)
    const d = Math.max(1.5, qs * 0.075)
    const r = d * 0.34
    const card = '#FFFDF8'
    const dots = (dir: 'x' | 'y') => `radial-gradient(circle at 50% 50%, ${card} ${r}cqmin, transparent ${r + 0.06}cqmin) 0 0 / ${u(d)} ${u(d)} repeat-${dir}`
    const edge = (pos: CSSProperties, dir: 'x' | 'y') => <span aria-hidden style={{ position: 'absolute', background: dots(dir), ...pos }} />
    return (
      <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ alignSelf: panel ? 'stretch' : 'center', width: panel ? undefined : u(70), marginRight: panel ? u(-9) : undefined, marginTop: u(S.gap * (panel ? 1.8 : 0)), padding: u(0.65), background: `repeating-linear-gradient(135deg, ${accent} 0 ${u(1.1)}, ${card} ${u(1.1)} ${u(1.8)}, ${hexA('#1B1A17', 0.85)} ${u(1.8)} ${u(2.9)}, ${card} ${u(2.9)} ${u(3.6)})`, boxShadow: '0 0.8cqmin 2.2cqmin rgba(0,0,0,0.14)', transform: panel ? 'none' : 'rotate(-1.2deg)', boxSizing: 'border-box' }}>
        <div style={{ background: card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(S.gap * (panel ? 0.7 : 0.5)), padding: panel ? `${u(S.gap * 1)} ${u(S.gap * 1.1)} ${u(S.gap * 1)} ${u(S.gap * 1.3)}` : `${u(S.gap * 1.25)} ${u(S.gap * 1.1)} ${u(S.gap * 1.25)} ${u(S.gap * 1.4)}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.facts * 0.32), minWidth: 0, flex: 1 }}>
            <span style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: u(panel ? fit(scanAsk, S.facts * 2.05, 26, 0.6) : fit(scanAsk, S.facts * 1.9, 38, 0.6)), lineHeight: 1.08, color: '#1B1A17', textWrap: 'balance' as any }}>{scanAsk}</span>
            {/* the scan line edits the QR's words, not the ask above it */}
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: u(fit(c.qr.label, S.facts * 0.74, panel ? 24 : 20, 0.6)), lineHeight: 1.35, color: accent, whiteSpace: 'nowrap' }}>{c.qr.label}</span></Pick>}
          </div>
          <svg viewBox="0 0 34 24" fill="none" stroke={accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(S.facts * (panel ? 2.6 : 1.7)), height: u(S.facts * (panel ? 1.85 : 1.2)), flexShrink: 0, marginLeft: u(S.gap * 0.4), marginRight: panel ? 0 : u(S.gap * 0.7) }}>
            <path d="M3 19 C 10 19, 14 11, 30 11" />
            <path d="M24 5.5 L30.5 11 L24 16.5" />
          </svg>
          <div style={{ position: 'relative', flexShrink: 0, background: '#FFFFFF', padding: u(qs * 0.06), transform: 'rotate(2.5deg)', boxShadow: '0 0.5cqmin 1.4cqmin rgba(0,0,0,0.2)' }}>
            <Qr c={c} t={t} ink={{ ...ink, onPhoto: false, rule: 'transparent' }} size={qs} sel={sel} labelSide="none" />
            {edge({ left: 0, right: 0, top: u(-d / 2), height: u(d) }, 'x')}
            {edge({ left: 0, right: 0, bottom: u(-d / 2), height: u(d) }, 'x')}
            {edge({ top: 0, bottom: 0, left: u(-d / 2), width: u(d) }, 'y')}
            {edge({ top: 0, bottom: 0, right: u(-d / 2), width: u(d) }, 'y')}
          </div>
        </div>
      </Pick>
    )
  })()
  const infoCard = (w: number) => (
    <div style={{ width: u(w * 0.94), marginTop: u(S.gap * 1.2), transform: 'rotate(3deg)', background: accent, padding: `${u(S.gap * 0.8)} ${u(S.gap)}`, outline: `${hair} solid ${hexA(t.isDark ? '#15161A' : '#FFFFFF', 0.55)}`, outlineOffset: u(-1.1), boxShadow: '0 0.7cqmin 1.8cqmin rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.3), textAlign: 'center', boxSizing: 'border-box' }}>
      {!c.townOnly && c.title && <Pick id={c.title.id} sel={sel}><div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: u(fit(c.title.text, S.facts * 0.8, 24, 0.6)), color: bandInk.ink, whiteSpace: 'nowrap' }}>{c.title.text}</div></Pick>}
      <PriceText c={c} t={t} ink={bandInk} size={S.price * 0.72} sel={sel} />
      {facts && <FactsLine c={c} t={t} ink={bandInk} size={S.facts * 0.8} sel={sel} />}
    </div>
  )
  const greeting = (k: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * (tall && c.leadGen ? 0.85 : 0.35) * k), alignItems: centered ? 'center' : 'flex-start', textAlign: align, minWidth: 0 }}>
      {c.leadGen ? (
        <>
          {c.kicker && <Pick id={c.kicker.id} sel={sel}><div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(fit(c.kicker.text, S.big * 0.5 * k, wide ? 19 : centered ? 13 : 11, wide ? 0.55 : 0.38)), lineHeight: 1.1, color: accent, whiteSpace: 'nowrap' }}>{c.kicker.text}</div></Pick>}
          {c.title && <Pick id={c.title.id} sel={sel}><SerifHeadline text={c.title.text} t={t} ink={ink} size={S.title * (portrait || tall ? 0.95 : 0.7) * k} align={align} o={c.title.o} placeholder={c.title.placeholder} comfortable={tall ? 30 : portrait ? 26 : pcard ? 28 : 30} accent={pcard ? accent : undefined} /></Pick>}
          {pcard && c.title && <span aria-hidden style={{ display: 'block', width: '30%', height: u(1.3), marginTop: u(S.gap * 0.3), marginBottom: u(S.gap * 0.25), background: `repeating-linear-gradient(135deg, ${accent} 0 ${u(1.6)}, transparent ${u(1.6)} ${u(2.7)}, ${hexA(ink.ink, 0.85)} ${u(2.7)} ${u(4.3)}, transparent ${u(4.3)} ${u(5.4)})` }} />}
          {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: tall || wide || !c.isPrint ? 5 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: tall ? '90%' : '94%', ...(tall ? { lineHeight: 1.55 } : {}) }} />}
          {askCta && !c.qr && <Pick id={askCta.id} sel={sel} style={{ marginTop: u(S.gap * 0.4), display: 'flex', justifyContent: centered ? 'center' : 'flex-start', width: '100%' }}><ScanPrompt label={askCta.label} t={t} ink={ink} size={S.facts * k} accent={accent} o={askCta.o} arrow={null} align={align} /></Pick>}
        </>
      ) : (
        <>
          <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(S.big * 0.42 * k), lineHeight: 1, color: accent }}>Greetings from</div>
          <Pick id={c.title?.id} sel={sel}>
            <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 700, textTransform: 'uppercase', letterSpacing: t.styleId === 'modern_luxury' ? '0.04em' : '-0.01em', fontSize: u(fit(town || 'Your Town', S.title * 0.95 * k, 11, 0.55)), lineHeight: 0.95, color: ink.ink }}>{(town || 'Your Town').replace(/,.*$/, '')}</div>
          </Pick>
          {<span aria-hidden style={{ display: 'block', width: centered ? '38%' : '30%', height: u(1.3), marginTop: u(S.gap * 0.55), background: `repeating-linear-gradient(135deg, ${accent} 0 ${u(1.6)}, transparent ${u(1.6)} ${u(2.7)}, ${hexA(ink.ink, 0.85)} ${u(2.7)} ${u(4.3)}, transparent ${u(4.3)} ${u(5.4)})` }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.6), marginTop: u(S.gap * 0.4), justifyContent: centered ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
            {false && news && !oh && <Pick id={c.big?.id || c.kicker?.id} sel={sel}><span style={{ display: 'inline-block', background: accent, color: t.isDark ? '#15161A' : '#FFFFFF', fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.facts * 0.72 * k), padding: `${u(S.facts * 0.3)} ${u(S.facts * 0.7)}` }}>{news}</span></Pick>}
            {!split && !c.townOnly && c.title && <span style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(S.facts * 0.72 * k), color: accent, whiteSpace: c.title.text.length > 28 ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: c.title.text.length > 28 ? (centered ? '86%' : '100%') : '100%', minWidth: 0, flexShrink: c.title.text.length <= 28 ? 0 : 1, textAlign: align, textWrap: 'balance' as any, lineHeight: 1.45 }}>{c.title.text}</span>}
          </div>
          {!split && !panel && <div style={{ display: 'flex', alignItems: 'baseline', gap: u(S.gap), flexWrap: 'wrap', justifyContent: centered ? 'center' : 'flex-start', marginTop: u(S.gap * 0.3), ...(true ? { background: accent, outline: `${hair} solid ${hexA(t.isDark ? '#15161A' : '#FFFFFF', 0.55)}`, outlineOffset: u(-1.1), padding: `${u(S.gap * 0.7)} ${u(S.gap * 2.6)}`, marginTop: u(S.gap * 0.8), boxShadow: '0 0.6cqmin 1.6cqmin rgba(0,0,0,0.16)', display: 'grid', justifyItems: 'center', rowGap: u(S.gap * 0.3), width: 'fit-content', alignSelf: centered ? 'center' : 'flex-start', whiteSpace: 'nowrap' } : {}) }}>
            <PriceText c={c} t={t} ink={bandInk} size={S.price * 0.82 * k} sel={sel} showLabel={c.isPrint} />
            {facts && <FactsLine c={c} t={t} ink={bandInk} size={S.facts * (centered ? 0.95 : 0.78) * k} sel={sel} />}
          </div>}
        </>
      )}
    </div>
  )
  const signOff = c.isPrint
    ? <PrintSignOff c={pcard ? { ...c, qr: null, finePrint: null } : c} t={t} ink={ink} S={S} sel={sel} fam={fam} qrLabel={scanPrompt ? false : undefined} big={pcard ? 1.15 : wide ? 1.3 : 1} />
    : (c.agent || c.logo) && (
      <div style={{ width: '100%', borderTop: `${hair} dashed ${ink.rule}`, paddingTop: u(S.gap * 0.8), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
        {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const mark = (size: number) => <Postmark size={size} color={hexA(ink.ink, oh ? 0.82 : 0.62)} ring={town || c.agent?.brokerage || 'OpenHousePal'} center={c.leadGen ? 'Hello' : /^open house$/i.test(news) ? 'Open\nHouse' : (news.split(' ').slice(-1)[0] || 'Mail')} sub={stampDate} />
  const frame = (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(135deg, ${accent} 0 ${u(2.4)}, ${paper} ${u(2.4)} ${u(4)}, ${hexA(ink.ink, 0.85)} ${u(4)} ${u(6.4)}, ${paper} ${u(6.4)} ${u(8)})` }} />
      <div style={{ position: 'absolute', inset: u(band), background: `radial-gradient(90% 70% at 10% 0%, ${hexA(accent, 0.12)}, transparent 60%), repeating-linear-gradient(0deg, rgba(0,0,0,0.016) 0 1px, transparent 1px 3px), ${paper}` }} />
    </>
  )
  const inset = band + P * 0.75

  if (wide) {
    return (
      <>
        {frame}
        <div style={{ position: 'absolute', inset: u(inset), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.7) }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(P * 0.8) }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap) }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: !c.leadGen || pcard ? 'flex-start' : 'center', paddingRight: u(pcard && c.leadGen ? 1 : 14), paddingTop: split ? u(S.gap * 4) : !c.leadGen || pcard ? u(S.gap * 0.4) : 0 }}>{greeting(c.isPrint ? (split ? 1.75 : 1.3) : fam === 'banner' ? 1.15 : 1.45)}{panel && scanSection}</div>
            {!scanSection && scanPrompt}
            {signOff}
          </div>
          <div style={{ position: 'relative', flexShrink: 0, alignSelf: split ? 'flex-start' : 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', ...(split ? { marginTop: u(oh || news ? 6 : 1) } : pcard ? { alignSelf: 'stretch', justifyContent: panel ? 'space-between' : 'flex-start', gap: panel ? 0 : u(S.gap * 2.2), marginTop: u(oh ? 7 : c.leadGen ? 0.5 : 5), paddingBottom: u(P * 0.3), transform: `translateX(${u(-1)})` } : {}) }}>
            {split && <>{framed(c.isPrint ? 50 : 56, 3)}{infoCard(c.isPrint ? 50 : 56)}</>}
            {panel && <>{framed(c.isPrint ? 52 : 58, 3)}<div style={{ marginBottom: u(-P * 0.45) }}>{statsPanel(c.isPrint ? 52 : 58)}</div></>}
            {pcard && !panel && <>{framed(52, 3)}{scanSection}</>}
            {split || pcard ? null : oh || (!c.leadGen && news) ? framed(c.isPrint ? 54 : 60, 3) : (
              <>
                <Stamp c={c} t={t} sel={sel} width={c.isPrint ? 54 : 60} rotate={3} paper={paper} />
                {/* Franked across the stamp's top corner - never over the QR code below it. */}
                <div style={{ position: 'absolute', left: u(-16), top: u(-9), transform: 'rotate(-14deg)', pointerEvents: 'none' }}>{mark(c.isPrint ? 24 : 26)}</div>
              </>
            )}
          </div>
        </div>
        {pcard && <FinePrint c={c} ink={ink} t={t} size={S.fine} oneLine />}
        </div>
      </>
    )
  }

  if (centered) {
    const mailerAsk = portrait && c.leadGen
    const pinned = tall || portrait || feed || story
    // hanger listings make room for the scan prompt: a slightly smaller photo, 3 story lines
    const stampW = story ? (c.leadGen ? 64 : 72) : tall ? (!c.leadGen && scanPrompt ? 68 : 74) : feed ? 54 : mailerAsk ? 52 : 47
    return (
      <>
        {frame}
        <div style={{ position: 'absolute', inset: u(inset), paddingTop: tall ? u(HANGER_ZONE - inset + 2) : 0, paddingBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * (tall && !c.leadGen && scanPrompt ? 0.75 : 1.1)) }}>
          {tall && <div aria-hidden style={{ flex: oh ? 0.2 : 0.35, minHeight: 0 }} />}
          {feed && <div aria-hidden style={{ flex: 0.6, minHeight: 0 }} />}
          <div style={{ flex: pinned ? 'none' : 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', ...(tall ? { paddingTop: u(stampW * (oh ? 0.16 : !c.leadGen ? 0.13 : 0.07)), paddingBottom: u(S.gap * (!c.leadGen && scanPrompt ? 0.5 : oh ? 1.6 : 1.1)) } : story ? { paddingTop: u(stampW * (oh ? 0.16 : 0.14)) } : oh ? { paddingTop: u(stampW * 0.14), paddingBottom: u(S.gap * 0.9) } : { paddingBottom: u(S.gap * 0.5 + (feed ? 3.5 : 0)) }) }}>
            {framed(stampW, -2.5, story || tall ? 0.95 : 0.78)}
          </div>
          {tall && scanPrompt && <div aria-hidden style={{ flex: 0.5, minHeight: 0 }} />}
          {story && <div aria-hidden style={{ flex: 1, minHeight: 0 }} />}
          {greeting(story ? 1.1 : feed ? (c.leadGen ? 1.3 : 1.05) : mailerAsk ? 1.3 : 1)}
          {!c.leadGen && (portrait || tall) && <div style={{ width: tall ? '100%' : '88%' }}><PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="center" clamp={tall ? (scanPrompt ? 3 : 4) : 2} /></div>}
          {(tall || portrait || feed || story) && <div aria-hidden style={{ flex: tall ? (scanPrompt ? 0.5 : 0.65) : 1, minHeight: portrait ? u(S.gap * (c.leadGen ? 1.5 : 0.6)) : 0 }} />}
          {scanPrompt}
          <div style={{ width: '100%' }}>{signOff}</div>
        </div>
      </>
    )
  }

  // Square + 4:5 post: the greeting on the left, the stamp franked on the right.
  return (
    <>
      {frame}
      <div style={{ position: 'absolute', inset: u(inset), display: 'flex', flexDirection: 'column', gap: u(S.gap) }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: u(P * 0.6) }}>
          <div style={{ flex: 1, minWidth: 0 }}>{greeting(1.15)}</div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {oh || (!c.leadGen && news) ? framed(46, 4, 1.08) : (
              <>
                <Stamp c={c} t={t} sel={sel} width={46} rotate={4} paper={paper} ratio={1.08} />
                <div style={{ position: 'absolute', right: u(-6), top: u(-10), transform: 'rotate(-12deg)', pointerEvents: 'none' }}>{mark(17)}</div>
              </>
            )}
          </div>
        </div>
        {scanPrompt}
        {signOff}
      </div>
    </>
  )
}

// ── Filmstrip: three frames on a strip of film, tilted across the page, the headline set big.
function FilmStrip({ c, t, sel, dir, thick, length, rotate }: { c: Content; t: DesignTheme; sel: Sel; dir: 'row' | 'column'; thick: number; length: number; rotate: number }) {
  const frames = photosFor(c, 3)
  const edgeW = thick * 0.14
  const hole = edgeW * 0.42
  const holes = Math.max(6, Math.floor(length / (hole * 2.3)))
  const row = dir === 'row'
  const holeStrip = (side: 'a' | 'b') => (
    <div style={{ position: 'absolute', display: 'flex', justifyContent: 'space-around', alignItems: 'center', ...(row ? { left: 0, right: 0, height: u(edgeW), [side === 'a' ? 'top' : 'bottom']: 0 } : { top: 0, bottom: 0, width: u(edgeW), flexDirection: 'column', [side === 'a' ? 'left' : 'right']: 0 }) } as CSSProperties}>
      {Array.from({ length: holes }).map((_, i) => <span key={i} style={{ width: u(hole), height: u(hole * 1.3), borderRadius: u(hole * 0.22), background: '#EFEBE3', opacity: 0.92, transform: row ? undefined : 'rotate(90deg)' }} />)}
    </div>
  )
  return (
    <div style={{ position: 'relative', [row ? 'width' : 'height']: u(length), [row ? 'height' : 'width']: u(thick), background: '#0E0E10', transform: `rotate(${rotate}deg)`, boxShadow: '0 2cqmin 5cqmin rgba(0,0,0,0.45)', flexShrink: 0 } as CSSProperties}>
      {holeStrip('a')}
      {holeStrip('b')}
      <div style={{ position: 'absolute', display: 'flex', flexDirection: dir, gap: u(thick * 0.06), ...(row ? { left: u(thick * 0.08), right: u(thick * 0.08), top: u(edgeW), bottom: u(edgeW) } : { top: u(thick * 0.08), bottom: u(thick * 0.08), left: u(edgeW), right: u(edgeW) }) }}>
        {frames.map((p, i) => <Photo key={i} photo={p} t={t} sel={sel} pickId={i === 0 ? (c.heroId || c.galleryId) : (c.galleryId || c.heroId)} style={{ flex: 1, position: 'relative' }} />)}
      </div>
      <span style={{ position: 'absolute', ...(row ? { left: u(thick * 0.5), top: u(edgeW * 0.02) } : { left: u(edgeW * 0.1), top: u(thick * 0.4), writingMode: 'vertical-rl' as any }), fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: u(edgeW * 0.34), color: '#D9A441', letterSpacing: '0.1em', opacity: 0.9, lineHeight: 1 }}>OHP 400 ▸ 24A</span>
    </div>
  )
}

// Filmstrip open house (user 10/10): the weekday, date and time on a second piece of film that
// crosses behind the photo strip - frees the space under the photos for the full description.
function DateFilm({ oh, t, sel, bleed, accent }: { oh: Extract<DetailItem, { kind: 'openHouse' }>; t: DesignTheme; sel: Sel; bleed: number; accent: string }) {
  const short3 = (w: string) => w.replace(/^([A-Za-z]{3})[A-Za-z]*\.?/, '$1')
  const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim()
  const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean)
  const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
  const multi = days.length > 1
  const parts = days.map(d => (d.includes(',') ? { wd: d.split(',')[0].trim(), md: short3(d.split(',').slice(1).join(',').trim()) } : { wd: '', md: short3(d.trim()) }))
  const md = parts.map(x => x.md.match(/^([A-Za-z]+)\s+(\d+)/))
  const sameMonth = multi && md.every(m => m && m[1].toLowerCase() === md[0]![1].toLowerCase())
  // two days, each with its own hours: one day on each side of the photos
  const perDay = multi && days.length === 2 && times.length === 2
  // a long range breaks after the dash so it stays big: "10:30 AM –" / "12:30 PM"
  const timeLines = (x: string) => (x.length > (perDay ? 9 : 12) && x.includes('–') ? [x.slice(0, x.indexOf('–') + 1).replace('–', ' –'), x.slice(x.indexOf('–') + 1).trim()] : [x])
  const time = times.join(' & ')
  const tall = perDay ? parts.some((_, i) => timeLines(times[i]).length > 1) : timeLines(time).length > 1
  const H = tall ? 26 : perDay ? 23 : 21
  const hole = 1.5
  const holes = (side: 'top' | 'bottom') => (
    <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, [side]: u(0.9), display: 'flex', justifyContent: 'space-around' }}>
      {Array.from({ length: 42 }).map((_, i) => <span key={i} style={{ width: u(hole), height: u(hole * 1.15), borderRadius: u(0.3), background: '#EFEBE3', opacity: 0.9 }} />)}
    </div>
  )
  const label: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.05 }
  const side = 22 // the visible width each side of the (slimmer, 40-wide) photo strip
  const small = (x: string) => <span style={{ ...label, color: accent, fontSize: u(fit(x, 2.5, 9, 0.7)), letterSpacing: '0.16em', paddingLeft: '0.16em' }}>{x}</span>
  const big = (x: string) => <span style={{ fontFamily: t.fonts.display, fontWeight: 700, color: '#FFFFFF', fontSize: u(fit(x, 5.6, 6.5, 0.55)), lineHeight: 1, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{x}</span>
  const hourSize = (l: string) => fit(l, 4.4, 7, 0.5)
  const sharedHour = perDay ? Math.min(...times.flatMap(x => timeLines(x)).map(hourSize)) : 0
  const hours = (x: string) => timeLines(x).map(l => <span key={l} style={{ ...label, color: '#FFFFFF', fontSize: u(perDay ? sharedHour : hourSize(l)), letterSpacing: '0.02em' }}>{l}</span>)
  const col = (children: ReactNode) => <div style={{ width: u(side), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.55), textAlign: 'center' }}>{children}</div>
  const multiTop = multi ? parts.map(x => short3(x.wd)).filter(Boolean).join(' & ') : ''
  const multiBig = !multi ? '' : sameMonth ? `${md[0]![1]} ${md.map(m => m![2]).join('–')}` : parts.map(x => x.md).join('–')
  return (
    <Pick id={oh.id} sel={sel} style={{ position: 'absolute', left: u(-bleed - 12), right: u(-bleed - 12), top: '50%', height: u(H), marginTop: u(6 - (H - 21) / 2), transform: 'rotate(5deg)', background: '#0E0E10', boxShadow: '0 1.4cqmin 3.5cqmin rgba(0,0,0,0.38)', zIndex: 0 }}>
      {holes('top')}
      {holes('bottom')}
      <div style={{ position: 'absolute', inset: `${u(3.6)} ${u(15.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {perDay
          ? parts.map((x, i) => <div key={i}>{col(<>{x.wd && small(x.wd)}{big(x.md)}{hours(times[i])}</>)}</div>)
          : <>
              {col(<>{(multi ? multiTop : parts[0]?.wd) && small(multi ? multiTop : parts[0].wd)}{big(multi ? multiBig : parts[0]?.md || '')}</>)}
              {col(<>{small('Open House')}{time && hours(time)}</>)}
            </>}
      </div>
    </Pick>
  )
}

function Filmstrip({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  const story = fam === 'story'
  const tall = fam === 'tall'
  const portrait = fam === 'portrait'
  const wide = fam === 'landscape' || fam === 'banner'
  const S = wide ? scaled(S0, c.isPrint ? 0.8 : 0.86) : S0
  const P = S.pad
  const T = tones(t)
  const ink = T.onStrong
  const facts = findFacts(c)
  const oh = findOpenHouse(c)
  const headline = (k: number, align: 'left' | 'center') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.45), alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align, minWidth: 0 }}>
      {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker * k} align={align} o={c.kicker.o} /></Pick>}
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.3), alignItems: align === 'center' ? 'center' : 'flex-start' }}>
          {c.leadGen
            ? <SerifHeadline text={c.title.text} t={t} ink={ink} size={S.title * (portrait || tall ? 1 : 0.78) * k} align={align} o={c.title.o} placeholder={c.title.placeholder} comfortable={portrait || tall ? 24 : 28} />
            : (tall || ((wide || portrait) && c.isPrint) || (!c.isPrint && fam !== 'landscape' && fam !== 'banner')) && c.title.isAddress
              ? <Title text={c.title.text} t={t} ink={ink} size={Math.min(S.title * 0.95 * k, (tall ? 84 : story ? 108 : !c.isPrint ? 94 : 86) / (c.title.text.length * (t.styleId === 'modern_luxury' ? 0.8 : 0.68)))} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={99} style={{ whiteSpace: 'nowrap' }} />
              : <Title text={c.title.text} t={t} ink={ink} size={S.title * 0.95 * k} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={14} />}
          {c.sub && (c.title.isAddress ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * k} align={align} /> : <Lede text={c.sub.text} t={t} ink={ink} size={S.body * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />)}
        </Pick>
      )}
    </div>
  )
  const askCta = c.leadGen ? (c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined) : undefined
  const listingAsk = !c.leadGen && c.qr ? (c.situation === 'open_house' ? 'Learn More' : c.situation === 'coming_soon' ? 'Be the first inside' : 'See every photo') : ''
  const qrArrow: 'left' | 'right' = tall ? 'left' : 'right'
  const scanPrompt = c.qr && (askCta || listingAsk) && (
    <Pick id={askCta?.id || c.qr.id} sel={sel} style={{ display: 'flex', justifyContent: qrArrow === 'left' ? 'center' : 'flex-end', width: '100%', marginBottom: u(S.gap * (tall ? 0.2 : 0.4)), paddingRight: qrArrow === 'right' ? u(S.qr * 0.3) : 0 }}>
      <ScanPrompt label={askCta?.label || listingAsk} sub={c.qr.label || undefined} t={t} ink={ink} size={S.facts * (wide ? 1.15 : 1)} accent={ink.accent} o={askCta?.o} arrow={qrArrow} />
    </Pick>
  )
  const priceRow = (k: number, align: 'left' | 'center') => !c.leadGen ? (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: u(S.gap * 1.2), flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <PriceText c={c} t={t} ink={ink} size={S.price * 0.85 * k} sel={sel} />
      {facts && <FactsLine c={c} t={t} ink={ink} size={S.facts * 1.05 * k} sel={sel} weight={700} />}
      {oh && !tall && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 0.95 * k} align={align} o={oh.o} /></Pick>}
    </div>
  ) : !c.qr && askCta ? (
    <Pick id={askCta.id} sel={sel} style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', width: '100%' }}>
      <ScanPrompt label={askCta.label} t={t} ink={ink} size={S.facts * k} accent={ink.accent} o={askCta.o} arrow={null} align={align} />
    </Pick>
  ) : null
  const signOff = c.isPrint
    ? <PrintSignOff c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} qrLabel={scanPrompt ? false : undefined} />
    : (c.agent || c.logo) && (
      <div style={{ width: '100%', borderTop: `${hair} solid ${ink.rule}`, paddingTop: u(S.gap * 0.8), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
        {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const bg = (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 45% at 50% 50%, ${hexA(ink.accent, 0.2)}, transparent 70%), radial-gradient(120% 90% at 0% 0%, ${hexA(ink.ink, 0.05)}, transparent 50%), ${T.strong}` }} />
  )

  // Postcards (user 10/12): the film strip stays down the right; on the left the address up top, then the
  // price + stats and the open house each on their own framed card (a fine film-edge of sprocket marks),
  // the QR on its own framed card above a slim footer (the Keepsake postcard's).
  if (((wide || portrait) && c.isPrint) || (!c.isPrint && (fam === 'square' || story))) {
    const accent = ink.accent
    const paperBg = t.isDark ? 'rgba(255,255,255,0.06)' : '#FFFDF9'
    const capsF: CSSProperties = { fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.1 }
    const colW = portrait || !c.isPrint ? 100 - P * 2 : 150 * 0.54
    const edge = (side: 'top' | 'bottom', from = 0) => (
      <div aria-hidden style={{ position: 'absolute', left: u(from + 1.8), right: u(1.8), [side]: u(0.75), display: 'flex', justifyContent: 'space-between' }}>
        {Array.from({ length: Math.max(8, Math.round(30 * (1 - from / 76))) }).map((_, i) => <span key={i} style={{ width: u(0.9), height: u(0.65), borderRadius: u(0.2), background: hexA(ink.ink, 0.13) }} />)}
      </div>
    )
    const onAccent = t.isDark ? '#15161A' : '#FFFFFF'
    const frame = (children: ReactNode, pad = `${u(2.9)} ${u(3)}`, tab?: string, style?: CSSProperties, panelW = 0) => (
      <div style={{ position: 'relative', background: paperBg, border: `${hair} solid ${hexA(accent, 0.55)}`, borderRadius: u(1.2), boxShadow: '0 0.8cqmin 2.2cqmin rgba(0,0,0,0.08)', padding: pad, ...style }}>
        {edge('top', panelW)}{edge('bottom', panelW)}
        {tab && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: accent, color: onAccent, ...capsF, letterSpacing: '0.24em', padding: `${u(0.7)} ${u(2)} ${u(0.7)} ${u(2.24)}`, borderRadius: u(0.5), fontSize: u(S.facts * 0.78), boxShadow: '0 0.4cqmin 1cqmin rgba(0,0,0,0.12)', zIndex: 1 }}>{tab}</span>}
        {children}
      </div>
    )
    // a gold side panel, flush with the card's left edge (the QR, the Open House label)
    const panel = (children: ReactNode, w: number) => (
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: u(w), background: `linear-gradient(160deg, ${accent}, ${hexA(accent, 0.86)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>{children}</div>
    )
    const qk = portrait && c.leadGen ? 1.4 : 1
    const shortW = colW * (portrait ? (c.leadGen ? 0.86 : 0.62) : 0.74)
    const items = facts?.items || []
    const descF = c.details.find(d => d.kind === 'description') as Extract<DetailItem, { kind: 'description' }> | undefined
    const priceW = facts ? colW * 0.38 : colW - 8
    const statColW = facts ? (colW - 8 - priceW - 4) / Math.max(1, items.length) : 0
    const priceSize = c.price ? Math.min(S.price * 1.35 * t.price.scale, (priceW - 1) / (c.price.value.length * 0.56)) * c.price.o.k : 0
    const statSize = facts ? Math.min(S.facts * 2.3, ...items.map(i => (statColW - 1) / (Math.max(2, i.value.length) * 0.5))) : 0
    const stackW = colW - 8
    const priceTab = c.price?.label || (c.situation === 'price_improvement' ? 'Now Offered At' : undefined)
    // the 4:5 post has the room for a bigger price + stats (user 10/12)
    const k45 = !c.isPrint && !story && fam === 'square' && ar < 0.9 ? 1.2 : 1
    const stackPrice = c.price ? Math.min(S.price * 1.42 * k45 * t.price.scale, (stackW - 4) / (c.price.value.length * 0.56)) * c.price.o.k : 0
    const stackStat = facts ? Math.min(S.facts * 2.35 * k45, ...items.map(i => (stackW / items.length - 2) / (Math.max(2, i.value.length) * 0.5))) : 0
    const stackCard = !c.leadGen && (c.price || facts) && frame(
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u(1.3) }}>
        {c.price && (
          <Pick id={c.price.id} sel={sel}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.9) }}>
              <span style={{ fontFamily: t.fonts.price, fontWeight: 600, letterSpacing: t.price.tracking, fontSize: u(stackPrice), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
              {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.8), color: ink.muted, textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
            </div>
          </Pick>
        )}
        {c.price && facts && (
          <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: u(1.2) }}>
            <span style={{ flex: 1, height: u(0.35), background: `linear-gradient(90deg, transparent, ${accent} 30%)` }} />
            <span style={{ width: u(1.5), height: u(1.5), background: accent, transform: 'rotate(45deg)' }} />
            <span style={{ flex: 1, height: u(0.35), background: `linear-gradient(270deg, transparent, ${accent} 30%)` }} />
          </div>
        )}
        {facts && (
          <Pick id={facts.id} sel={sel}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
              {items.map((i, n) => (
                <div key={i.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.7), borderLeft: n ? `${hair} solid ${hexA(accent, 0.35)}` : undefined, minWidth: 0 }}>
                  <span style={{ fontFamily: t.fonts.price, fontWeight: 600, fontSize: u(stackStat), color: ink.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
                  <span style={{ ...capsF, color: accent, letterSpacing: '0.14em', fontSize: u(S.facts * 0.8) }}>{i.label}</span>
                </div>
              ))}
            </div>
          </Pick>
        )}
      </div>, `${u(3.4)} ${u(3.2)} ${u(2.4)}`, priceTab
    )
    const priceCard = !c.leadGen && (c.price || facts) && frame(
      <div style={{ display: 'flex', alignItems: 'center', gap: u(2.2) }}>
        {c.price && (
          <Pick id={c.price.id} sel={sel} style={{ flex: facts ? '0 0 auto' : 1, width: facts ? u(priceW) : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.7) }}>
              <span style={{ fontFamily: t.fonts.price, fontWeight: 600, letterSpacing: t.price.tracking, fontSize: u(priceSize), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
              {c.price.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 600, fontSize: u(S.facts * 0.66), color: ink.muted, textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{c.price.previous}</span>}
            </div>
          </Pick>
        )}
        {c.price && facts && <span aria-hidden style={{ alignSelf: 'stretch', width: u(0.35), flexShrink: 0, background: `linear-gradient(180deg, transparent, ${accent} 18%, ${accent} 82%, transparent)` }} />}
        {facts && (
          <Pick id={facts.id} sel={sel} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
              {items.map((i, n) => (
                <div key={i.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.6), borderLeft: n ? `${hair} solid ${hexA(accent, 0.35)}` : undefined, minWidth: 0 }}>
                  <span style={{ fontFamily: t.fonts.price, fontWeight: 600, fontSize: u(statSize), color: ink.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{i.value}</span>
                  <span style={{ ...capsF, color: accent, letterSpacing: '0.12em', fontSize: u(S.facts * 0.74) }}>{i.label}</span>
                </div>
              ))}
            </div>
          </Pick>
        )}
      </div>, `${u(3.2)} ${u(3)} ${u(2.6)}`, priceTab
    )
    const ohCard = (() => {
      if (c.leadGen || !oh) return null
      const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
      const days = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
      const times = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
      const rows = days.map((d, k) => {
        const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
        const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
        return { wd, md: m ? `${m[1].slice(0, 3)} ${m[2]}` : rest, time: times.length > 1 ? times[k] ?? '' : times[0] ?? '' }
      })
      return frame(
        <Pick id={oh.id} sel={sel}>
          {panel(<span style={{ ...capsF, color: onAccent, letterSpacing: '0.2em', paddingLeft: '0.2em', fontSize: u(S.facts * 0.9), lineHeight: 1.35, whiteSpace: 'normal', textAlign: 'center' }}>Open<br />House</span>, 15)}
          <div style={{ display: 'flex', alignItems: 'center', gap: u(2.4), padding: `${u(3)} 0 ${u(3)} ${u(17.4)}` }}>
            {rows.map((x, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(0.5), borderLeft: i ? `${hair} solid ${hexA(accent, 0.35)}` : undefined, textAlign: 'center' }}>
                {x.wd && <span style={{ ...capsF, color: ink.muted, letterSpacing: '0.18em', paddingLeft: '0.18em', fontSize: u(S.facts * 0.74) }}>{x.wd}</span>}
                <span style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(Math.min(S.facts * 2.3, (rows.length > 1 ? 24 : 44) / (x.md.length * 0.55))), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{x.md}</span>
                {x.time && <span style={{ ...capsF, color: accent, letterSpacing: '0.06em', fontSize: u(Math.min(S.facts * 1.05, (rows.length > 1 ? 24 : 44) / (x.time.length * 0.62))) }}>{x.time}</span>}
              </div>
            ))}
          </div>
        </Pick>, `0 ${u(3)} 0 0`, undefined, { overflow: 'hidden', ...(rows.length > 1 ? {} : { width: u(shortW), alignSelf: 'center' }) }, 15
      )
    })()
    const askText = (askCta?.label || listingAsk || '').replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())
    const qrS = S.qr * 0.92 * qk * (qk > 1 ? 1.4 : 1)
    const qrPanelW = qrS + (qk > 1 ? 5.6 : 6.2)
    const qrCard = c.qr && frame(
      <Pick id={askCta?.id || c.qr.id} sel={sel}>
        {panel(
          <div style={{ borderRadius: u(0.6), padding: u(0.8), background: '#FFFFFF' }}>
            <Qr c={c} t={t} ink={{ ...ink, ink: '#111111' }} size={qrS} sel={sel} labelSide="none" />
          </div>, qrPanelW
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: u(3), minHeight: u(qrS + (qk > 1 ? 6 : 6.4)), paddingLeft: u(qrPanelW + 3 * qk) }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(qk > 1 ? 2.2 : 1), padding: `${u(2.4)} 0` }}>
            {askText && <FitLines text={askText} size={S.facts * 2.05 * qk} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.1, color: ink.ink, textWrap: 'balance' as any }} />}
            {c.qr.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...capsF, color: accent, letterSpacing: '0.16em', fontSize: u(Math.min(S.facts * 0.9 * qk, (shortW - qrPanelW - 7) / (c.qr.label.length * 0.8))) }}>{c.qr.label}</span></Pick>}
          </div>
        </div>
      </Pick>, `0 ${u(3)} 0 0`, undefined, { overflow: 'hidden', width: u(shortW), alignSelf: 'center' }, qrPanelW
    )
    const footer = (c.agent || c.finePrint) && (
      <div data-foot="" style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6), width: '100%' }}>
        {c.agent && (
          <>
            <Rule color={ink.rule} />
            <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.2) }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><AgentCard fitLong c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={0.95} showContact={false} noTitle /></div>
              <div style={{ flexShrink: 0 }}><SplitContacts splitMail c={c} t={t} ink={ink} S={S} sel={sel} scale={0.68} /></div>
            </div>
          </>
        )}
        <FinePrint c={c} ink={ink} t={t} size={S.fine} oneLine />
      </div>
    )
    const leadBlock = (withQr: boolean, k = 1, bodyK = 1, gapK = 1) => {
      const kick = c.kicker?.text || ''
      const kickFs = Math.min(S.kicker * 1.45 * k, (colW - 30) / (Math.max(6, kick.length) * 0.95))
      const tt = c.title ? titleCase(c.title.text) : ''
      const line = <span aria-hidden style={{ flex: '0 0 auto', width: u(9 * k), height: hair, background: accent }} />
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: u(S.gap * 0.72 * k * gapK), padding: `0 ${u(1.5)}` }}>
          {kick && <Pick id={c.kicker!.id} sel={sel}><div style={{ display: 'flex', alignItems: 'center', gap: u(2.4) }}>{line}<span style={{ fontFamily: t.fonts.kicker, fontWeight: t.kicker.weight, textTransform: 'uppercase', letterSpacing: '0.32em', paddingLeft: '0.32em', fontSize: u(kickFs), color: accent, whiteSpace: 'nowrap' }}>{kick}</span>{line}</div></Pick>}
          {c.title && <Pick id={c.title.id} sel={sel} style={{ width: '100%' }}><FitLines text={tt} size={S.title * 0.78 * 1.45 * 1.12 * k * (c.title.o.k || 1)} lines={2} style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 600, letterSpacing: '-0.005em', lineHeight: 1.08, color: ink.ink, textAlign: 'center', textWrap: 'balance' as any, opacity: c.title.placeholder ? 0.45 : 1, ...c.title.o.css }} /></Pick>}
          {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.3 * k * bodyK} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
          <span aria-hidden style={{ width: u(16), height: u(0.5), borderRadius: u(0.3), background: accent }} />
          {withQr && qrCard && <div style={{ marginTop: u(S.gap * 0.25), display: 'flex', justifyContent: 'center', width: '100%' }}>{qrCard}</div>}
        </div>
      )
    }
    if (!c.isPrint) {
      // Social (user 10/12): the approved print pieces on the feed - the address (or the lead-gen words) up
      // top, the film strip across, the framed price card / open house card, the ask on a framed card,
      // the social sign-off with the Instagram button
      const tall45 = story || ar < 0.9
      const stripT = c.leadGen ? (story ? 32 : tall45 ? 28 : c.socialButton ? 20 : 23) : story ? (oh ? 32 : 40) : oh ? (tall45 ? 30 : c.socialButton ? 15 : 19) : tall45 ? 37 : 29
      const askCard = c.leadGen && askCta && frame(
        <Pick id={askCta.id} sel={sel}>
          <FitLines text={askText} size={S.facts * (story ? 2.4 : tall45 ? 2.9 : 2.5)} lines={story ? 2 : 1} style={{ fontFamily: t.fonts.display, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.1, color: ink.ink, textAlign: 'center', textWrap: 'balance' as any }} />
        </Pick>, `${u(tall45 ? 3 : 2.2)} ${u(4)}`, undefined, { width: u(colW * (story ? 0.72 : 0.9)), alignSelf: 'center' }
      )
      return (
        <>
          {bg}
          <div style={{ position: 'absolute', inset: 0, padding: story ? `11cqh ${u(P)} 10cqh` : `${u(P * 0.85)} ${u(P)} ${u(P * 0.7)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
            {c.leadGen
              ? (story ? leadBlock(false, 0.9) : leadBlock(false, tall45 ? 0.96 : 0.82, tall45 ? 1.36 : 1.28, 1.02))
              : headline(story ? 1.5 : tall45 ? 1.42 : oh ? 1.12 : 1.28, 'center')}
            {/* the strip keeps its full height; everything under it sits centred in the room that's left */}
            <div style={{ flex: (story || tall45) && !(story && c.leadGen) ? '0 0 auto' : 1, minHeight: u(stripT + 7.5), display: 'flex', alignItems: 'center', justifyContent: 'center', width: `calc(100% + ${u(P * 3.2)})`, ...((story || tall45) && !(story && c.leadGen) ? { margin: `${u(S.gap * 0.6)} 0` } : {}) }}>
              <FilmStrip c={c} t={t} sel={sel} dir="row" thick={stripT} length={130} rotate={-3} />
            </div>
            <div style={{ ...((story || tall45) && !(story && c.leadGen) ? { flex: 1, minHeight: 0, justifyContent: 'space-evenly', ...(!story && !c.leadGen ? { paddingBottom: u(5) } : {}) } : {}), ...(!story && !tall45 && !c.leadGen ? { marginTop: u(-1.6), marginBottom: u(1.6) } : {}), width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
              {!c.leadGen && <div style={{ width: tall45 ? '86%' : '100%' }}>{tall45 ? stackCard : priceCard}</div>}
              {ohCard && <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: (oh?.date || '').match(/&|\band\b/i) ? 'stretch' : 'center' }}>{ohCard}</div>}
              {askCard}
            </div>
            <div style={{ width: '100%' }}>{signOff}</div>
          </div>
        </>
      )
    }
    if (portrait) {
      const sDaysF = oh ? oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).length : 0
      // Letter / flyer (user 10/12): the approved postcard pieces stood up - the address (or the lead-gen
      // words) up top, the film strip across the page, the framed price card, the open house card,
      // the description, the QR card centred, the slim footer
      return (
        <>
          {bg}
          <div style={{ position: 'absolute', inset: 0, padding: `${u(P * 0.85)} ${u(P)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
            {c.leadGen ? leadBlock(false, 1.05) : headline(1.3, 'center')}
            {/* lead-gen: the strip keeps its full height, the spare room splits around the QR card */}
            <div style={{ ...(c.leadGen ? { flex: '0 0 auto', height: u(39) } : { flex: 1, minHeight: 0, marginTop: u(oh ? 0.5 : 4.5) }), display: 'flex', alignItems: 'center', justifyContent: 'center', width: `calc(100% + ${u(P * 3.2)})` }}>
              <FilmStrip c={c} t={t} sel={sel} dir="row" thick={c.leadGen ? 31.5 : 31} length={130} rotate={-3} />
            </div>
            {c.leadGen && <div style={{ flex: 0.45, minHeight: 0 }} />}
            {!c.leadGen && <div style={{ width: oh ? '100%' : '84%', marginTop: u(oh ? 0 : 2.6) }}>{oh ? priceCard : stackCard}</div>}
            {ohCard && <div style={{ width: sDaysF > 1 ? '92%' : '100%', display: 'flex', flexDirection: 'column', alignItems: sDaysF > 1 ? 'stretch' : 'center' }}>{ohCard}</div>}
            {!c.leadGen && !oh && descF && <Pick id={descF.id} sel={sel} style={{ width: '88%' }}><Lede text={descF.text} t={t} ink={ink} size={S.body * 1.05} align="center" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }} /></Pick>}
            {qrCard && <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{qrCard}</div>}
            {c.leadGen && <div style={{ flex: 0.55, minHeight: 0 }} />}
            <div style={{ width: '100%' }}>{footer}</div>
          </div>
        </>
      )
    }
    return (
      <>
        {bg}
        <div style={{ position: 'absolute', top: '-12%', bottom: '-12%', right: u(P * 1.2), display: 'flex', alignItems: 'center' }}>
          <FilmStrip c={c} t={t} sel={sel} dir="column" thick={150 * 0.25} length={135} rotate={5} />
        </div>
        <div style={{ position: 'absolute', left: u(P), top: u(P * 0.6), bottom: u(P * 0.6), width: '54%', display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1), zIndex: 2 }}>
          {!c.leadGen && headline(1.42, 'left')}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * 1.2) }}>
            {c.leadGen && leadBlock(true)}
            {oh ? priceCard : stackCard}
            {ohCard}
            {!c.leadGen && !oh && descF && <Pick id={descF.id} sel={sel}><Lede text={descF.text} t={t} ink={ink} size={S.body * 1.05} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }} /></Pick>}
          </div>
          {!c.leadGen && qrCard}
          {footer}
        </div>
      </>
    )
  }

  if (wide) {
    const W = fam === 'banner' ? 300 : 150 * (c.isPrint ? 1 : 1.27)
    return (
      <>
        {bg}
        <div style={{ position: 'absolute', top: '-12%', bottom: '-12%', right: u(P * 1.2), display: 'flex', alignItems: 'center' }}>
          <FilmStrip c={c} t={t} sel={sel} dir="column" thick={W * 0.25} length={135} rotate={5} />
        </div>
        <div style={{ position: 'absolute', left: u(P), top: u(P * 0.8), bottom: u(P * 0.7), width: '54%', display: 'flex', flexDirection: 'column', gap: u(S.gap), zIndex: 2 }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u(S.gap * 0.9) }}>
            {headline(c.isPrint ? (c.leadGen ? 1.55 : 1.42) : fam === 'banner' ? 1.1 : 1.45, 'left')}
            {priceRow(c.isPrint ? 1.3 : fam === 'banner' ? 1.05 : 1.3, 'left')}
            {c.isPrint && !c.leadGen && <PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="left" clamp={3} />}
          </div>
          {scanPrompt}
          {signOff}
        </div>
      </>
    )
  }

  if (tall) {
    return (
      <>
        {bg}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(HANGER_ZONE + 5)} ${u(P)} ${u(P * 0.7)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
          {headline(1, 'center')}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative', paddingTop: u(3) }}>
            {oh && <DateFilm oh={oh} t={t} sel={sel} bleed={P} accent={ink.accent} />}
            <div style={{ position: 'relative', zIndex: 1 }}><FilmStrip c={c} t={t} sel={sel} dir="column" thick={c.leadGen ? 54 : oh ? 40 : 46} length={c.leadGen ? 98 : oh ? 84 : 80} rotate={-3} /></div>
          </div>
          {priceRow(1, 'center')}
          {!c.leadGen && <PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="center" clamp={oh ? 4 : 3} />}
          {scanPrompt}
          <div style={{ width: '100%' }}>{signOff}</div>
        </div>
      </>
    )
  }

  const thick = story ? 44 : portrait ? 42 : 38
  return (
    <>
      {bg}
      <div style={{ position: 'absolute', inset: 0, padding: `${story ? '12cqh' : u(P * 0.85)} ${u(P)} ${story ? '11cqh' : u(P * 0.7)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1) }}>
        {headline(story ? 1.22 : portrait ? 1.3 : 1.15, story || portrait ? 'center' : 'left')}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: `0 ${u(-P * 1.6)}` }}>
          <FilmStrip c={c} t={t} sel={sel} dir="row" thick={thick} length={130} rotate={story ? -5 : -3.5} />
        </div>
        {priceRow(story ? 1.3 : portrait ? 1.25 : 1.12, story || portrait ? 'center' : 'left')}
        {portrait && !c.leadGen && <PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="center" clamp={2} />}
        {scanPrompt}
        {signOff}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// QR-led mailers (2026-10-08). A mailer's whole job is the scan, so each of these is built AROUND
// the QR code from the agent's form (the Leads step's tracked link): a ticket stub, a price tag,
// a phone showing the form it opens, a scan target, a neighbor's note with a sticky-note QR, a
// scratch-off. Print pieces only (postcards, letter mailers, door hangers); a social size falls
// back to Billboard - social posts never carry a QR.
// ---------------------------------------------------------------------------------------------
const QR_ASK: Record<string, { tag: string; big: string; fields: string[] }> = {
  make_me_sell: { tag: 'Your number', big: '$ ? ? ?', fields: ['Your address', 'The price that would move you', 'Your timing'] },
  home_valuation: { tag: "Your home's value", big: '$ ? ? ?', fields: ['Your address', 'Beds & baths', 'Recent updates'] },
  find_dream_home: { tag: 'Your next home', big: '? ? ?', fields: ['Towns you love', 'Your budget', 'Your must-haves'] },
}
function askOf(c: Content) {
  return QR_ASK[c.situation || ''] || { tag: c.price?.label || 'The details', big: c.price?.value || '', fields: ['Your name', 'Your questions', 'Best time to talk'] }
}
const ctaOf = (c: Content) => (c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined)?.label || ''
const PAPER = '#FCF9F2'
const PAPER_INK: Ink = { ink: '#1E1D1B', muted: '#6E675C', accent: '#8A6638', rule: 'rgba(30,29,27,0.16)', fill: '#8A6638', fillInk: '#FFFFFF', onPhoto: false, panel: PAPER }
const paperInk = (t: DesignTheme): Ink => ({ ...PAPER_INK, accent: t.isDark ? '#8A6638' : t.accent, fill: t.isDark ? '#8A6638' : t.accent, fillInk: t.isDark ? '#FFFFFF' : t.accentInk })

// The QR at the size a mailer needs - quiet white margin, optional scan-frame corners. With the QR
// switched off, the agent's number takes its place (the piece still asks for a response).
function ScanQr({ c, t, ink, size, sel, label = true, corners, labelSize, labelColor }: {
  c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; label?: boolean; corners?: string; labelSize?: number; labelColor?: string
}) {
  if (!c.qr) {
    const phone = c.agent?.phone
    if (!phone) return null
    return (
      <Pick id={c.agent?.id} sel={sel} style={{ width: u(size), padding: u(size * 0.1), borderRadius: u(size * 0.08), background: '#fff', color: '#15161A', textAlign: 'center', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(size * 0.08) }}>Call or text</div>
        <div style={{ fontFamily: t.fonts.price, fontWeight: 700, fontSize: u(fit(phone, size * 0.15, 12, 0.6)), marginTop: u(size * 0.05), whiteSpace: 'nowrap' }}>{phone}</div>
      </Pick>
    )
  }
  const k = size * 0.085
  const corner = (v: 't' | 'b', h: 'l' | 'r') => (
    <span key={v + h} style={{
      position: 'absolute', width: u(size * 0.22), height: u(size * 0.22), borderStyle: 'solid', borderColor: corners, borderWidth: 0,
      [v === 't' ? 'top' : 'bottom']: u(-k), [h === 'l' ? 'left' : 'right']: u(-k),
      [v === 't' ? 'borderTopWidth' : 'borderBottomWidth']: u(size * 0.032), [h === 'l' ? 'borderLeftWidth' : 'borderRightWidth']: u(size * 0.032),
      [`border${v === 't' ? 'Top' : 'Bottom'}${h === 'l' ? 'Left' : 'Right'}Radius`]: u(size * 0.06),
    } as CSSProperties} />
  )
  return (
    <Pick id={c.qr.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(size * 0.08), flexShrink: 0 }}>
      <div style={{ position: 'relative', width: u(size), height: u(size) }}>
        <div style={{ position: 'absolute', inset: 0, background: '#fff', padding: u(size * 0.075), borderRadius: u(size * 0.06), boxSizing: 'border-box', boxShadow: '0 0.8cqmin 2.6cqmin rgba(0,0,0,0.22)' }}><QrSvg url={c.qr.url} eye={t.accent} /></div>
        {corners && [corner('t', 'l'), corner('t', 'r'), corner('b', 'l'), corner('b', 'r')]}
      </div>
      {label && c.qr.label && (
        <div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: u(labelSize || Math.max(1.3, size * 0.075)), lineHeight: 1.3, color: labelColor || ink.ink, textAlign: 'center', maxWidth: u(size * 1.4) }}>{c.qr.label}</div>
      )}
    </Pick>
  )
}

// The words of a QR-led piece: eyebrow, the headline, the ask (lead magnets) or the listing line.
function QrPitch({ c, t, ink, S, sel, align = 'left', k = 1, max = 18, cta = true, clamp = 3 }: {
  c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; align?: 'left' | 'center'; k?: number; max?: number; cta?: boolean; clamp?: number
}) {
  const oh = findOpenHouse(c)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.55 * k), alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align, minWidth: 0 }}>
      {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker * k} align={align} o={c.kicker.o} /></Pick>}
      {c.title && <Pick id={c.title.id} sel={sel}><Title text={c.title.text} t={t} ink={ink} size={S.title * 0.86 * k} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={max} /></Pick>}
      {c.leadGen
        ? c.sub && clamp > 0 && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />
        : (
          <>
            {c.sub && <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 0.9 * k} align={align} />}
            <div style={{ display: 'flex', gap: u(S.gap), alignItems: 'baseline', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
              <PriceText c={c} t={t} ink={ink} size={S.price * 0.66 * k} sel={sel} />
              <FactsLine c={c} t={t} ink={ink} size={S.facts * 0.92 * k} sel={sel} />
            </div>
            {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 0.95 * k} align={align} o={oh.o} /></Pick>}
          </>
        )}
      {cta && <Details c={c} t={t} ink={ink} S={scaled(S, k)} align={align} sel={sel} only={['cta']} />}
    </div>
  )
}

function QrFoot({ c, t, ink, S, sel, scale = 0.92, align = 'left', fam }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; scale?: number; align?: 'left' | 'center'; fam?: DesignFamily }) {
  // letters / flyers (user 10/11, every theme): the agent left, the numbers + email set right
  const split = fam === 'portrait' && c.isPrint && !!c.agent
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.4), width: '100%', alignItems: align === 'center' && !split ? 'center' : 'stretch' }}>
      {split
        ? <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 1.2) }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}><AgentCard c={c} t={t} ink={ink} S={S} sel={sel} align="left" scale={Math.max(scale, 0.95) * 1.05} showContact={false} noTitle /></div>
            <SplitContacts c={c} t={t} ink={ink} S={S} sel={sel} scale={Math.max(scale, 0.95)} />
          </div>
        : c.agent && <AgentCard c={c} t={t} ink={ink} S={S} sel={sel} narrow scale={scale} align={align} />}
      <FinePrint c={c} ink={ink} t={t} size={S.fine} align={align} />
    </div>
  )
}

const qrFallback = (props: CompProps) => !props.c.isPrint || props.fam === 'square' || props.fam === 'story'

// ── 1. Ticket: the offer as an admission ticket - photo + pitch on the ticket, the QR on the stub.
function Ticket(props: CompProps) {
  if (qrFallback(props)) return <Billboard {...props} />
  const { c, t, fam, S: S0, sel } = props
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const S = wide ? scaled(S0, 1) : S0
  const P = S.pad * (wide ? 0.85 : 1)
  const T = tones(t)
  const back = t.surface
  const stubInk = T.onLight
  const onPhoto = inkOnPhoto(t)
  const serial = String((((c.title?.text || 'OHP').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7919) % 900000) + 100000)
  const notch = wide ? 7 : 8
  const admit = <span style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.32em', paddingLeft: '0.32em', fontSize: u(S.kicker * 0.78), color: stubInk.accent, whiteSpace: 'nowrap' }}>Admit one</span>
  const num = <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600, fontSize: u(S.fine * 1.15), letterSpacing: '0.24em', color: stubInk.muted, whiteSpace: 'nowrap' }}>No. {serial}</span>
  // Door hanger (user 10/13 rebuild): the approved door-hanger order on an admission ticket - the status big,
  // the photo with its address plate (or the offer's plate), a date strip / the price + stats (or the
  // promises), then the perforated stub with a QR and the ask; the agent centred under the ticket.
  if (tall) {
    const paper = T.light
    const pk = stubInk
    const W = 100 - P * 1.2
    const capsT: CSSProperties = { fontFamily: t.fonts.label, textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.15 }
    const oh = findOpenHouse(c)
    const facts = findFacts(c)
    const addr = c.title?.isAddress ? c.title : null
    const word = (c.leadGen ? (c.kicker?.text || '') : newsWord(c)).toUpperCase()
    const wLines = !c.leadGen && word.includes(' ') ? splitLines(word, 2) : [word]
    const headFs = Math.min(12, (W * 0.86) / (Math.max(4, ...wLines.map(l => l.length)) * 0.72))
    const qLines = c.leadGen && c.title ? splitLines(c.title.text.toUpperCase(), c.title.text.length > 30 ? 3 : 2) : []
    const qFs = Math.min(7.6, (W * 0.88) / (Math.max(6, ...qLines.map(l => l.length)) * 0.66))
    const aLines = addr ? (addr.text.length > 22 ? splitLines(addr.text, 2) : [addr.text]) : []
    const aFs = addr ? Math.min(5.2, (W * 0.8) / (Math.max(...aLines.map(l => l.length)) * 0.62)) : 0
    const sFs = c.sub ? Math.min(2.4, (W * 0.7) / (c.sub.text.length * 0.98)) : 0
    const plateText = addr ? null : c.leadGen ? (c.kicker?.text || '') : ''
    const ptFs = plateText ? Math.min(3.8, (W * 0.7) / (plateText.length * 0.82)) : 0
    const plateH = addr ? aFs * 1.1 * aLines.length + (c.sub ? sFs * 1.4 + 0.9 : 0) + 3.6 : plateText ? ptFs * 1.2 + 3.6 : 0
    // open house: one ticket-style date strip per day - SAT · NOV 22 | 1-3 PM
    const days = oh ? (() => {
      const clean = (x: string) => x.replace(/:00/g, '').replace(/\s*[–—-]\s*/g, '–').replace(/\s+/g, ' ').trim().replace(/^(\d+(?::\d+)?)\s*(AM|PM)–(\d+(?::\d+)?)\s*\2$/i, '$1–$3 $2')
      const ds = oh.date.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean).slice(0, 2)
      const ts = oh.time.split(/\s*(?:&|\band\b|\/)\s*/i).map(clean).filter(Boolean)
      return ds.map((d, k) => {
        const [wd, rest] = d.includes(',') ? [d.split(',')[0].trim(), d.split(',').slice(1).join(',').trim()] : ['', d.trim()]
        const m = rest.match(/^([A-Za-z]+)\.?\s+(\d+)/)
        return { label: [wd.slice(0, 3), m ? `${m[1].slice(0, 3)} ${m[2]}` : rest].filter(Boolean).join(' · ').toUpperCase(), time: (ts.length > 1 ? ts[k] ?? '' : ts[0] ?? '').toUpperCase() }
      })
    })() : []
    const dLen = Math.max(10, ...days.map(d => d.label.length + d.time.length + 3))
    const dFs = Math.min(2.7, (W * 0.8) / (dLen * 0.78))
    const dates = oh && days.length > 0 && (
      <Pick id={oh.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.2) }}>
        {days.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch', border: `${hair} solid ${hexA(pk.accent, 0.7)}`, borderRadius: u(0.8), overflow: 'hidden' }}>
            <span style={{ ...capsT, fontWeight: 800, letterSpacing: '0.14em', fontSize: u(dFs), color: t.accentInk || '#FFFFFF', background: pk.accent, padding: `${u(1.1)} ${u(1.8)}` }}>{d.label}</span>
            {d.time && <span style={{ ...capsT, fontWeight: 700, letterSpacing: '0.06em', fontSize: u(dFs), color: pk.ink, padding: `${u(1.1)} ${u(1.8)}` }}>{d.time}</span>}
          </div>
        ))}
      </Pick>
    )
    const priceRow = (c.price || facts) && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.1) }}>
        {c.price && (
          <Pick id={c.price.id} sel={sel}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: u(1.4) }}>
              {c.price.label && <span style={{ ...capsT, fontWeight: 700, letterSpacing: '0.2em', fontSize: u(1.9), color: pk.muted }}>{c.price.label}</span>}
              <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(Math.min(7.4 * c.price.o.k, (W * 0.6) / (c.price.value.length * 0.56))), lineHeight: 1, color: pk.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...c.price.o.css }}>{c.price.value}</span>
            </div>
          </Pick>
        )}
        {facts && (
          <Pick id={facts.id} sel={sel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: u(1.6), ...capsT, fontWeight: 700, letterSpacing: '0.12em', fontSize: u(Math.min(2.6, (W * 0.86) / (facts.items.map(i => `${i.value} ${i.label}`).join('    ').length * 0.62))), color: pk.ink }}>
              {facts.items.map((i, k) => <Fragment key={i.key}>{k > 0 && <span style={{ width: u(0.7), height: u(0.7), background: pk.accent, transform: 'rotate(45deg)' }} />}<span>{i.value} {SHORT_FACT[i.label] ?? i.label.toUpperCase()}</span></Fragment>)}
            </div>
          </Pick>
        )}
      </div>
    )
    // lead-gen: the note as short promises on diamond rows
    const promises = c.leadGen && c.sub ? c.sub.text.split(/(?<=[.!?])\s+/).flatMap(x => x.split(/\s+[-–—]\s+/)).map(x => x.replace(/[.,]$/, '').trim()).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1)).slice(0, 3) : []
    const promiseRows = promises.length > 0 && c.sub && (
      <Pick id={c.sub.id} sel={sel} style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(1.1), maxWidth: '92%' }}>
          {promises.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: u(1.5), fontSize: u(3), lineHeight: 1.3, textAlign: 'left' }}>
              <span style={{ flexShrink: 0, height: u(3 * 1.3), display: 'flex', alignItems: 'center', lineHeight: 0 }}><span style={{ display: 'inline-block', width: u(0.9), height: u(0.9), background: pk.accent, transform: 'rotate(45deg)' }} /></span>
              <span style={{ fontFamily: t.fonts.body, fontWeight: 500, color: pk.ink, textWrap: 'balance' as CSSProperties['textWrap'] }}>{l}</span>
            </div>
          ))}
        </div>
      </Pick>
    )
    const photoBlock = (
      <div style={{ position: 'relative', width: '90%', flex: 1, minHeight: u(30), marginBottom: u(plateH / 2) }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: u(0.8), boxShadow: '0 1.2cqmin 3cqmin rgba(0,0,0,0.22)' }}>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
        </div>
        {(addr || plateText) && (
          <Pick id={addr ? addr.id : c.kicker?.id} sel={sel} style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)', zIndex: 3, width: 'max-content', maxWidth: u(W), background: paper, border: `${hair} solid ${hexA(pk.accent, 0.75)}`, borderRadius: u(0.8), boxShadow: '0 1cqmin 2.4cqmin rgba(0,0,0,0.2)', padding: `${u(1.5)} ${u(3)} ${u(1.7)}`, textAlign: 'center' }}>
            {addr ? <>
              <div style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: u(aFs), lineHeight: 1.1, color: pk.ink }}>{aLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div>
              {c.sub && <div style={{ ...capsT, marginTop: u(0.9), fontWeight: 700, letterSpacing: '0.24em', paddingLeft: '0.24em', fontSize: u(sFs), color: pk.accent }}>{c.sub.text}</div>}
            </> : <div style={{ ...capsT, fontWeight: 800, letterSpacing: '0.2em', paddingLeft: '0.2em', fontSize: u(ptFs), color: pk.accent }}>{plateText}</div>}
          </Pick>
        )}
      </div>
    )
    const askCta = c.details.find(d => d.kind === 'cta') as Extract<DetailItem, { kind: 'cta' }> | undefined
    const askT = (askCta?.label || (oh ? 'Learn More' : 'See every photo')).replace(/(^|\s)(\S)/g, (_m: string, a: string, ch: string) => a + ch.toUpperCase())
    const askLines = askT.length > 16 ? splitLines(askT, 2) : [askT]
    const qs = 19
    const askFs = Math.min(4.2, (W - qs - 18) / (Math.max(...askLines.map(l => l.length)) * 0.46))
    const stubT = (
      <div style={{ position: 'relative', flexShrink: 0, background: paper, borderTop: `${u(0.45)} dashed ${hexA(pk.ink, 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(3.4), padding: `${u(3.2)} ${u(3)} ${u(3)}` }}>
        {[0, 1].map(i => <span key={i} aria-hidden style={{ position: 'absolute', width: u(notch), height: u(notch), borderRadius: '50%', background: back, top: u(-notch / 2), [i ? 'right' : 'left']: u(-notch / 2) } as CSSProperties} />)}
        {c.qr && <div style={{ flexShrink: 0, padding: u(0.8), background: '#FFFFFF', borderRadius: u(1), border: `${hair} solid ${hexA(pk.accent, 0.6)}` }}><Qr c={c} t={t} ink={{ ...pk, ink: '#111111' }} size={qs} sel={sel} labelSide="none" /></div>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: u(1.1), minWidth: 0 }}>
          {admit}
          <Pick id={askCta?.id || c.qr?.id} sel={sel}><div style={{ fontFamily: t.fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: u(askFs), lineHeight: 1.08, color: pk.ink }}>{askLines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>
          {c.qr?.label && <Pick id={c.qr.id} sel={sel}><span style={{ ...capsT, display: 'block', fontWeight: 800, letterSpacing: '0.16em', fontSize: u(Math.min(2.1, (W - qs - 18) / (c.qr.label.length * 0.8))), color: pk.accent }}>{c.qr.label}</span></Pick>}
          {num}
        </div>
      </div>
    )
    const footer = (c.agent || c.finePrint) && (
      <div data-foot="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(1.2), width: '100%' }}>
        {c.agent && <AgentCard fitLong c={c} t={t} ink={inkOnBg(t)} S={S} sel={sel} align="center" scale={1.05} showContact={false} noTitle />}
        {c.agent && <SplitContacts center c={c} t={t} ink={inkOnBg(t)} S={S} sel={sel} scale={0.9} />}
        <FinePrint c={c} ink={inkOnBg(t)} t={t} size={S.fine} align="center" />
      </div>
    )
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(45deg, ${hexA(t.ink, 0.035)} 0 ${u(0.8)}, transparent ${u(0.8)} ${u(2.2)}), ${back}` }} />
        <div style={{ position: 'absolute', inset: 0, padding: `${u(HANGER_ZONE - 2)} ${u(P * 0.6)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(3) }}>
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', borderRadius: u(2.2), overflow: 'hidden', background: paper, boxShadow: '0 1.6cqmin 4cqmin rgba(0,0,0,0.24)', transform: 'rotate(-0.6deg)' }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(2.6), padding: `${u(4.4)} ${u(2.6)} ${u(3.4)}`, textAlign: 'center' }}>
              <div aria-hidden style={{ position: 'absolute', inset: u(1.6), border: `${hair} dashed ${hexA(pk.accent, 0.5)}`, borderRadius: u(1.2), pointerEvents: 'none' }} />
              {c.leadGen ? (
                c.title && <Pick id={c.title.id} sel={sel}><div>{qLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, letterSpacing: '0.02em', fontSize: u(qFs), lineHeight: 1.05, color: i % 2 ? pk.accent : pk.ink, whiteSpace: 'nowrap' }}>{l}</div>)}</div></Pick>
              ) : (
                <Pick id={c.big?.id || c.kicker?.id} sel={sel}>
                  <div>{wLines.map((l, i) => <div key={i} style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, letterSpacing: '0.05em', paddingLeft: '0.05em', fontSize: u(headFs), lineHeight: 1, color: wLines.length > 1 && i === 0 ? pk.ink : pk.accent, whiteSpace: 'nowrap' }}>{l}</div>)}</div>
                </Pick>
              )}
              {photoBlock}
              {dates}
              {!c.leadGen && priceRow}
              {promiseRows}
            </div>
            {stubT}
          </div>
          {footer}
        </div>
      </>
    )
  }
  const qrSize = wide ? 34 : tall ? 50 : 30
  const stub = (
    <div style={{ position: 'relative', flex: '0 0 auto', width: wide ? '34%' : '100%', background: T.light, display: 'flex', flexDirection: wide || tall ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: u(S.gap * (wide ? 0.7 : 1.1)), padding: u(P * (tall ? 0.7 : 0.5)), [wide ? 'borderLeft' : 'borderTop']: `${u(0.45)} dashed ${hexA(stubInk.ink, 0.35)}` } as CSSProperties}>
      {[0, 1].map(i => <span key={i} aria-hidden style={{ position: 'absolute', width: u(notch), height: u(notch), borderRadius: '50%', background: back, ...(wide ? { left: u(-notch / 2), [i ? 'bottom' : 'top']: u(-notch / 2) } : { top: u(-notch / 2), [i ? 'right' : 'left']: u(-notch / 2) }) } as CSSProperties} />)}
      {wide || tall ? (
        <>
          {admit}
          <ScanQr c={c} t={t} ink={stubInk} size={qrSize} sel={sel} labelSize={S.kicker * (tall ? 0.8 : 0.72)} />
          {num}
        </>
      ) : (
        <>
          <ScanQr c={c} t={t} ink={stubInk} size={qrSize} sel={sel} label={false} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5), minWidth: 0, flex: 1 }}>
            {admit}
            {c.qr?.label && <Pick id={c.qr.id} sel={sel}><div style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, letterSpacing: t.display.tracking, fontSize: u(fit(c.qr.label, S.title * 0.5, 22, 0.6)), lineHeight: 1.08, color: stubInk.ink }}>{c.qr.label}</div></Pick>}
            {num}
          </div>
        </>
      )}
    </div>
  )
  const main = tall ? (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: `rgb(${t.scrim})` }}>
      <div style={{ position: 'relative', flex: 1, minHeight: '30%' }}>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, rgb(${t.scrim}) 0%, rgba(${t.scrim},0) 34%)`, pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'relative', padding: `${u(P * 0.2)} ${u(P * 0.75)} ${u(P * 0.75)}` }}>
        <QrPitch c={c} t={t} ink={onPhoto} S={S} sel={sel} k={1.05} max={15} clamp={4} />
      </div>
      <div style={{ position: 'absolute', inset: u(P * 0.3), border: `${hair} dashed ${hexA(onPhoto.ink, 0.42)}`, borderRadius: u(1.2), pointerEvents: 'none' }} />
    </div>
  ) : (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${wide ? '90deg' : '0deg'}, rgba(${t.scrim},0.94) 0%, rgba(${t.scrim},0.72) ${wide ? 42 : 38}%, rgba(${t.scrim},0.14) ${wide ? 78 : 72}%, rgba(${t.scrim},0) 100%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, padding: u(P * 0.75), display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', maxWidth: wide ? '80%' : '100%' }}>
        <QrPitch c={c} t={t} ink={onPhoto} S={S} sel={sel} k={tall ? 1.05 : wide ? 1 : 1.35} max={wide ? 16 : 15} clamp={tall ? 4 : 3} />
      </div>
      <div style={{ position: 'absolute', inset: u(P * 0.3), border: `${hair} dashed ${hexA(onPhoto.ink, 0.42)}`, borderRadius: u(1.2), pointerEvents: 'none' }} />
    </div>
  )
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(45deg, ${hexA(t.ink, 0.035)} 0 ${u(0.8)}, transparent ${u(0.8)} ${u(2.2)}), ${back}` }} />
      <div style={{ position: 'absolute', inset: 0, padding: `${u(tall ? HANGER_ZONE : P * 0.6)} ${u(P * 0.6)} ${u(P * 0.5)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8) }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column', borderRadius: u(2.2), overflow: 'hidden', boxShadow: '0 1.6cqmin 4cqmin rgba(0,0,0,0.28)', transform: 'rotate(-0.6deg)' }}>
          {main}
          {stub}
        </div>
        <QrFoot fam={fam} c={c} t={t} ink={inkOnBg(t)} S={S} sel={sel} scale={wide ? 0.82 : 0.95} />
      </div>
    </>
  )
}

// ── 2. Price Tag: a paper tag hanging on a string over the photo - the number (or the ask) and the QR on it.
function HangTag({ c, t, sel, width, rotate, stringLen }: { c: Content; t: DesignTheme; sel: Sel; width: number; rotate: number; stringLen: number }) {
  const ink = paperInk(t)
  const ask = askOf(c)
  const W = width
  return (
    <div style={{ position: 'relative', width: u(W), transform: `rotate(${rotate}deg)`, transformOrigin: '50% 0', filter: 'drop-shadow(0 1.6cqmin 2.4cqmin rgba(0,0,0,0.38))' }}>
      <span aria-hidden style={{ position: 'absolute', left: '50%', bottom: '100%', width: u(0.45), height: u(stringLen), marginBottom: u(-W * 0.12), background: 'linear-gradient(180deg, rgba(232,222,200,0.2), #E8DEC8)', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'relative', background: PAPER, clipPath: 'polygon(50% 0, 100% 15%, 100% 100%, 0 100%, 0 15%)', padding: `${u(W * 0.3)} ${u(W * 0.09)} ${u(W * 0.1)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(W * 0.04), textAlign: 'center' }}>
        <span aria-hidden style={{ position: 'absolute', left: '50%', top: u(W * 0.1), width: u(W * 0.09), height: u(W * 0.09), borderRadius: '50%', background: '#2B2723', boxShadow: `0 0 0 ${u(W * 0.018)} ${ink.accent}`, transform: 'translateX(-50%)' }} />
        <span aria-hidden style={{ position: 'absolute', inset: u(W * 0.045), top: u(W * 0.2), border: `${hair} dashed ${hexA(ink.accent, 0.55)}`, pointerEvents: 'none' }} />
        <span style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.24em', paddingLeft: '0.24em', fontSize: u(W * 0.05), color: ink.accent }}>{ask.tag}</span>
        {ask.big && (
          <Pick id={c.leadGen ? c.title?.id : c.price?.id} sel={sel}>
            <div style={{ fontFamily: t.fonts.display, fontWeight: t.styleId === 'bold' ? 400 : 700, fontSize: u(fit(ask.big, W * 0.2, 9, 0.5)), lineHeight: 1, color: ink.ink, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{ask.big}</div>
          </Pick>
        )}
        <span aria-hidden style={{ width: '62%', height: hair, background: hexA(ink.ink, 0.2), margin: `${u(W * 0.02)} 0` }} />
        <ScanQr c={c} t={t} ink={ink} size={W * 0.58} sel={sel} labelSize={W * 0.045} />
      </div>
    </div>
  )
}

function PriceTag(props: CompProps) {
  if (qrFallback(props)) return <Billboard {...props} />
  const { c, t, fam, S: S0, sel } = props
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const S = wide ? scaled(S0, 1) : S0
  const P = S.pad * (wide ? 0.85 : 1)
  const T = tones(t)
  const onPhoto = inkOnPhoto(t)
  if (wide) {
    return (
      <>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '62%' }} />
        <div style={{ position: 'absolute', inset: 0, background: T.strong, clipPath: 'polygon(0 0, 49% 0, 41% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: T.onStrong.fill, clipPath: 'polygon(49% 0, 49.8% 0, 41.8% 100%, 41% 100%)' }} />
        <div style={{ position: 'absolute', left: u(P), top: u(P * 0.8), bottom: u(P * 0.6), width: '38%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap), zIndex: 2 }}>
          <QrPitch c={c} t={t} ink={T.onStrong} S={S} sel={sel} k={0.95} max={13} clamp={3} />
          <QrFoot fam={fam} c={c} t={t} ink={T.onStrong} S={S} sel={sel} scale={0.8} />
        </div>
        <div style={{ position: 'absolute', right: u(P * 1.6), top: u(9), zIndex: 3 }}><HangTag c={c} t={t} sel={sel} width={42} rotate={-5} stringLen={16} /></div>
      </>
    )
  }
  const photoPct = tall ? 52 : 60
  return (
    <>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%`, background: `linear-gradient(0deg, rgba(${t.scrim},0.5) 0%, rgba(${t.scrim},0) 40%)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${100 - photoPct}%`, background: T.strong, padding: `${u(P * 0.8)} ${u(P)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap), zIndex: 2 }}>
        <div><QrPitch c={c} t={t} ink={T.onStrong} S={S} sel={sel} k={tall ? 1.05 : 1.3} max={tall ? 16 : 15} clamp={3} /></div>
        <QrFoot fam={fam} c={c} t={t} ink={T.onStrong} S={S} sel={sel} />
      </div>
      <div style={{ position: 'absolute', zIndex: 3, ...(tall ? { left: '50%', top: u(HANGER_ZONE + 6), transform: 'translateX(-50%)' } : { right: u(P * 0.9), top: u(12) }) }}>
        <HangTag c={c} t={t} sel={sel} width={tall ? 54 : 42} rotate={tall ? -3 : -5} stringLen={tall ? 30 : 18} />
      </div>
    </>
  )
}

// ── 3. Scan & Go: the QR and, beside it, the phone showing exactly the form it opens - no mystery.
function PhoneMock({ c, t, width }: { c: Content; t: DesignTheme; width: number }) {
  const W = width
  const ask = askOf(c)
  const accent = t.isDark ? t.accent : t.accent
  const accentInk = t.isDark ? t.accentInk : t.accentInk
  const title = (c.leadGen ? c.title?.text : ctaOf(c) || c.title?.text) || 'Tell me about your home'
  const button = ctaOf(c) || 'Get my answer'
  const a = c.agent
  const fs = (k: number) => u(W * k)
  return (
    <div style={{ position: 'relative', width: u(W), height: u(W * 2.04), background: '#0E0E11', borderRadius: u(W * 0.16), padding: u(W * 0.045), boxShadow: '0 2cqmin 5cqmin rgba(0,0,0,0.45), inset 0 0 0 0.3cqmin #2a2a30', flexShrink: 0 }}>
      <span aria-hidden style={{ position: 'absolute', top: u(W * 0.07), left: '50%', width: u(W * 0.28), height: u(W * 0.06), borderRadius: 999, background: '#000', transform: 'translateX(-50%)', zIndex: 2 }} />
      <div style={{ width: '100%', height: '100%', background: '#FFFFFF', borderRadius: u(W * 0.12), overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: `${fs(0.16)} ${fs(0.07)} ${fs(0.07)}`, gap: fs(0.045), fontFamily: t.fonts.body, color: '#18181B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: fs(0.04) }}>
          {a?.photo ? <img src={a.photo} alt="" style={{ width: fs(0.13), height: fs(0.13), borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: fs(0.13), height: fs(0.13), borderRadius: '50%', background: accent }} />}
          <span style={{ fontSize: fs(0.05), fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a?.name || 'Your agent'}</span>
        </div>
        <div style={{ fontFamily: t.fonts.display, fontWeight: 700, fontSize: fs(fit(title, 0.085, 22, 0.6) / 1), lineHeight: 1.12, textTransform: t.display.transform === 'uppercase' ? 'uppercase' : 'none' }}>{title}</div>
        {ask.fields.map(f => (
          <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: fs(0.015) }}>
            <span style={{ fontSize: fs(0.038), fontWeight: 700, color: '#52525B' }}>{f}</span>
            <span style={{ height: fs(0.1), borderRadius: fs(0.025), border: `${u(Math.max(0.12, W * 0.006))} solid #E4E4E7`, background: '#FAFAFA' }} />
          </div>
        ))}
        <div style={{ marginTop: 'auto', borderRadius: fs(0.035), background: accent, color: accentInk, textAlign: 'center', padding: `${fs(0.04)} ${fs(0.03)}`, fontSize: fs(0.048), fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{button}</div>
        <div style={{ textAlign: 'center', fontSize: fs(0.032), color: '#A1A1AA' }}>Takes about a minute · no spam</div>
      </div>
    </div>
  )
}

function ScanArrow({ color, width, flip = false }: { color: string; width: number; flip?: boolean }) {
  return (
    <svg viewBox="0 0 60 30" style={{ width: u(width), height: u(width * 0.5), overflow: 'visible', transform: flip ? 'scaleY(-1)' : undefined, flexShrink: 0 }}>
      <path d="M4,24 C18,2 40,2 54,16" fill="none" stroke={color} strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" />
      <path d="M46,16 L55,17 L52,8" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Steps({ c, t, ink, size, align = 'left' }: { c: Content; t: DesignTheme; ink: Ink; size: number; align?: 'left' | 'center' }) {
  const items = ['Scan the code', c.leadGen ? 'Answer a few questions' : 'See every detail', c.leadGen ? 'Get your answer' : 'Ask me anything']
  return (
    <div style={{ display: 'flex', columnGap: u(size * 1.2), rowGap: u(size * 0.6), flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      {items.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: u(size * 0.45) }}>
          <span style={{ width: u(size * 1.6), height: u(size * 1.6), borderRadius: '50%', background: ink.fill, color: ink.fillInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.fonts.label, fontWeight: 800, fontSize: u(size * 0.85), flexShrink: 0 }}>{i + 1}</span>
          <span style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(size), color: ink.ink, whiteSpace: 'nowrap' }}>{s}</span>
        </div>
      ))}
    </div>
  )
}

function ScanGo(props: CompProps) {
  if (qrFallback(props)) return <Billboard {...props} />
  const { c, t, fam, S: S0, sel } = props
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const S = wide ? scaled(S0, 1) : S0
  const P = S.pad * (wide ? 0.85 : 1)
  const T = tones(t)
  const ink = T.onStrong
  const bg = <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(55% 60% at ${wide ? '78% 50%' : '50% 62%'}, ${hexA(ink.accent, 0.26)}, transparent 70%), ${T.strong}` }} />
  if (wide) {
    return (
      <>
        {bg}
        <div style={{ position: 'absolute', left: u(P), top: u(P * 0.8), bottom: u(P * 0.6), width: '42%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1) }}>
            <QrPitch c={c} t={t} ink={ink} S={S} sel={sel} k={0.95} max={13} cta={false} clamp={3} />
            <Steps c={c} t={t} ink={ink} size={S.facts * 0.62} />
          </div>
          <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} scale={0.82} />
        </div>
        <div style={{ position: 'absolute', right: u(P), top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: u(2) }}>
          <ScanQr c={c} t={t} ink={ink} size={28} sel={sel} corners={ink.accent} labelSize={S.kicker * 0.66} />
          <ScanArrow color={ink.accent} width={9} />
          <PhoneMock c={c} t={t} width={27} />
        </div>
      </>
    )
  }
  if (tall) {
    return (
      <>
        {bg}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(HANGER_ZONE + 2)} ${u(P)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
          <QrPitch c={c} t={t} ink={ink} S={S} sel={sel} align="center" k={1.05} max={14} cta={false} clamp={3} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PhoneMock c={c} t={t} width={44} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: u(3) }}>
            <ScanQr c={c} t={t} ink={ink} size={40} sel={sel} corners={ink.accent} label={false} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5), maxWidth: u(40) }}>
              <span style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, fontSize: u(fit(c.qr?.label || 'Scan with your camera', S.title * 0.42, 18, 0.6)), lineHeight: 1.1, color: ink.ink }}>{c.qr?.label || 'Scan with your camera'}</span>
              <ScanArrow color={ink.accent} width={14} flip />
            </div>
          </div>
          <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} />
        </div>
      </>
    )
  }
  return (
    <>
      {bg}
      <div style={{ position: 'absolute', inset: 0, padding: `${u(P * 0.9)} ${u(P)} ${u(P * 0.6)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 1.1) }}>
        <QrPitch c={c} t={t} ink={ink} S={S} sel={sel} align="center" k={1.4} max={15} cta={false} clamp={3} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(3) }}>
          <ScanQr c={c} t={t} ink={ink} size={36} sel={sel} corners={ink.accent} labelSize={S.kicker * 0.95} />
          <ScanArrow color={ink.accent} width={12} />
          <PhoneMock c={c} t={t} width={33} />
        </div>
        <Steps c={c} t={t} ink={ink} size={S.facts * 1.05} align="center" />
        <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} />
      </div>
    </>
  )
}

// ── 4. Target: the QR at the center of a bullseye ringed with "scan me", set on the photo's edge.
function Target({ c, t, sel, size, ring, ringInk }: { c: Content; t: DesignTheme; sel: Sel; size: number; ring: string; ringInk: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const words = (c.qr ? 'SCAN ME  ✦  ' : 'CALL OR TEXT  ✦  ').repeat(c.qr ? 6 : 4)
  return (
    <div style={{ position: 'relative', width: u(size), height: u(size), flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs><path id={`tg${id}`} d="M50,50 m-40.5,0 a40.5,40.5 0 1,1 81,0 a40.5,40.5 0 1,1 -81,0" /></defs>
        <circle cx="50" cy="50" r="64" fill="none" stroke={ring} strokeOpacity="0.16" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="57" fill="none" stroke={ring} strokeOpacity="0.3" strokeWidth="1.1" />
        <circle cx="50" cy="50" r="48" fill={ring} />
        <text fill={ringInk} style={{ fontFamily: t.fonts.label, fontWeight: 800, fontSize: 5.6, letterSpacing: 1.1 }}><textPath href={`#tg${id}`}>{words}</textPath></text>
        <circle cx="50" cy="50" r="34.5" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="33" fill="none" stroke={ring} strokeWidth="0.6" strokeDasharray="1.4 1.4" />
      </svg>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
        {c.qr
          ? <Pick id={c.qr.id} sel={sel} style={{ width: u(size * 0.44), height: u(size * 0.44) }}><QrSvg url={c.qr.url} eye={t.accent} /></Pick>
          : <ScanQr c={c} t={t} ink={PAPER_INK} size={size * 0.5} sel={sel} />}
      </div>
    </div>
  )
}

function Bullseye(props: CompProps) {
  if (qrFallback(props)) return <Billboard {...props} />
  const { c, t, fam, S: S0, sel } = props
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const S = wide ? scaled(S0, 1) : S0
  const P = S.pad * (wide ? 0.85 : 1)
  const T = tones(t)
  const ink = T.onStrong
  const qrLine = c.qr?.label && (
    <Pick id={c.qr.id} sel={sel}><div style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.kicker * 0.85), color: ink.accent }}>{c.qr.label}</div></Pick>
  )
  if (wide) {
    const D = 62
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: T.strong }} />
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%' }} />
        <div style={{ position: 'absolute', left: `calc(40% - ${u(D / 2)})`, top: `calc(50% - ${u(D / 2)})`, zIndex: 3 }}><Target c={c} t={t} sel={sel} size={D} ring={ink.fill} ringInk={ink.fillInk} /></div>
        <div style={{ position: 'absolute', left: `calc(40% + ${u(D / 2 + 5)})`, right: u(P * 0.8), top: u(P * 0.8), bottom: u(P * 0.6), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap), zIndex: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
            <QrPitch c={c} t={t} ink={ink} S={S} sel={sel} k={1} max={13} clamp={3} cta={false} />
            {qrLine}
          </div>
          <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} scale={0.8} />
        </div>
      </>
    )
  }
  const photoPct = tall ? 40 : 36
  const D = tall ? 80 : 62
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: T.strong }} />
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%` }} />
      <div style={{ position: 'absolute', left: `calc(50% - ${u(D / 2)})`, top: `calc(${photoPct}% - ${u(D / 2)})`, zIndex: 3 }}><Target c={c} t={t} sel={sel} size={D} ring={ink.fill} ringInk={ink.fillInk} /></div>
      <div style={{ position: 'absolute', left: u(P), right: u(P), top: `calc(${photoPct}% + ${u(D / 2 + 6)})`, bottom: u(P * 0.6), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: u(S.gap), zIndex: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 0.8), textAlign: 'center' }}>
          {qrLine}
          <QrPitch c={c} t={t} ink={ink} S={S} sel={sel} align="center" k={tall ? 1.05 : (c.title?.text.length || 0) > 26 ? 1.18 : 1.3} max={16} clamp={tall ? 3 : 2} />
        </div>
        <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} align="center" />
      </div>
    </>
  )
}

// ── 5. Neighbor Note: a handwritten-feeling note on lined paper, a photo clipped on, the QR on a sticky note.
const NOTE_LINE: Record<string, (addr: string, price: string, oh: string) => string> = {
  just_sold: (a, p) => `I just sold ${a}${p ? ` for ${p}` : ''}.`,
  just_listed: (a, p) => `I just listed ${a}${p ? ` at ${p}` : ''}.`,
  open_house: (a, _p, oh) => `I'm hosting an open house at ${a}${oh ? ` - ${oh}` : ''}. Come by!`,
  under_contract: a => `${a} is now under contract.`,
  price_improvement: (a, p) => `${a} just got a new price${p ? `: ${p}` : ''}.`,
  coming_soon: a => `${a} is coming to the market soon.`,
}
function NeighborNote(props: CompProps) {
  if (qrFallback(props)) return <Billboard {...props} />
  const { c, t, fam, S: S0, sel } = props
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const S = wide ? scaled(S0, 1) : S0
  const P = S.pad * (wide ? 0.85 : 1)
  const ink = paperInk(t)
  const script = ink.accent
  const lh = wide ? 7.4 : tall ? 7.4 : 7
  const margin = wide ? 9 : 10
  const oh = findOpenHouse(c)
  const first = (c.agent?.name || '').split(' ')[0] || 'Your neighbor'
  const line = c.leadGen ? '' : (NOTE_LINE[c.situation || ''] || NOTE_LINE.just_listed)(c.title?.text || 'a home nearby', c.price?.value || '', oh ? [oh.date, oh.time].filter(Boolean).join(', ') : '')
  const follow = c.leadGen ? (c.sub?.text || '') : "If you've ever wondered what your home could bring - or what's next for you - I'd be glad to help. Just scan my note."
  const bodyFs = S.body * (wide ? 1.05 : tall ? 1.25 : 1.45)
  const sticky = (w: number) => (
    <div style={{ width: u(w), background: '#F6E27F', padding: u(w * 0.08), transform: 'rotate(4deg)', boxShadow: '0 1cqmin 2.2cqmin rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(w * 0.04), flexShrink: 0, position: 'relative' }}>
      <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: u(w * 0.08), background: 'rgba(0,0,0,0.05)' }} />
      <ScanQr c={c} t={t} ink={PAPER_INK} size={w * 0.78} sel={sel} label={false} />
      <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(w * 0.15), lineHeight: 1, color: '#2B2824' }}>Scan me!</div>
      {c.qr?.label && <div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: u(w * 0.055), color: '#4A4438', textAlign: 'center', lineHeight: 1.25 }}>{c.qr.label}</div>}
    </div>
  )
  const note = (style: CSSProperties, stickyW: number) => (
    <div style={{
      position: 'absolute', ...style, background: `linear-gradient(90deg, transparent ${u(margin)}, rgba(214,96,96,0.5) ${u(margin)}, rgba(214,96,96,0.5) calc(${u(margin)} + 0.25cqmin), transparent calc(${u(margin)} + 0.25cqmin)), repeating-linear-gradient(180deg, transparent 0 ${u(lh - 0.22)}, rgba(96,140,196,0.3) ${u(lh - 0.22)} ${u(lh)}), ${PAPER}`,
      boxShadow: '0 1.6cqmin 4cqmin rgba(0,0,0,0.32)', transform: 'rotate(-1.2deg)', padding: `${u(lh * 1.1)} ${u(P * 0.6)} ${u(P * 0.5)} ${u(margin + 3)}`, display: 'flex', flexDirection: 'column', gap: u(lh * 0.35),
    }}>
      <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(lh * 1.25), lineHeight: 1, color: script }}>Hi neighbor,</div>
      {c.leadGen && c.title && <Pick id={c.title.id} sel={sel}><div style={{ fontFamily: t.fonts.display, fontWeight: 700, fontSize: u(fit(c.title.text, lh * 1.05, 22, 0.7)), lineHeight: 1.15, color: ink.ink }}>{c.title.text}</div></Pick>}
      {line && <Pick id={c.title?.id} sel={sel}><div style={{ fontFamily: t.fonts.display, fontWeight: 600, fontSize: u(bodyFs * 1.1), lineHeight: 1.35, color: ink.ink }}>{line}</div></Pick>}
      {follow && <div style={{ fontFamily: t.fonts.body, fontStyle: 'italic', fontSize: u(bodyFs), lineHeight: 1.45, color: '#3A3833', display: '-webkit-box', WebkitLineClamp: tall ? 6 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{follow}</div>}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(P * 0.4) }}>
        <Pick id={c.agent?.id} sel={sel} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(0.6) }}>
          <div style={{ fontFamily: DESIGN_FONTS.script, fontSize: u(lh * 1.35), lineHeight: 1, color: '#2B2824' }}>{first}</div>
          <div style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(S.agentMeta * 1.05), color: ink.ink, letterSpacing: '0.04em' }}>{[c.agent?.name, c.agent?.brokerage].filter(Boolean).join(' · ')}</div>
          {(c.agent?.phone || c.agent?.email) && <div style={{ fontFamily: t.fonts.label, fontSize: u(S.agentMeta), color: ink.muted, display: 'flex', flexWrap: 'wrap', columnGap: u(S.agentMeta) }}>{c.agent?.phone && <Tel kind="mobile" num={c.agent.phone} />}{c.agent?.email && <span>{c.agent.email}</span>}</div>}
          {c.agent?.office && <Tel kind="office" num={c.agent.office} style={{ fontFamily: t.fonts.label, fontSize: u(S.agentMeta), color: ink.muted }} />}
          <FinePrint c={c} ink={ink} t={t} size={S.fine * 0.9} />
        </Pick>
        {sticky(stickyW)}
      </div>
    </div>
  )
  const backdrop = (
    <>
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(${t.scrim},0.62)`, pointerEvents: 'none' }} />
    </>
  )
  if (wide) {
    return (
      <>
        {backdrop}
        {note({ left: u(P * 0.6), top: u(P * 0.55), bottom: u(P * 0.55), width: '64%' }, 30)}
        <div style={{ position: 'absolute', right: u(P * 0.7), top: u(P * 0.7), zIndex: 3 }}><InstantPrint c={c} t={t} sel={sel} width={36} rotate={5} caption="" /></div>
      </>
    )
  }
  return (
    <>
      {backdrop}
      <div style={{ position: 'absolute', zIndex: 3, ...(tall ? { left: '50%', top: u(HANGER_ZONE + 2), transform: 'translateX(-50%)' } : { right: u(P * 0.8), top: u(P * 0.6) }) }}><InstantPrint c={c} t={t} sel={sel} width={tall ? 60 : 40} rotate={tall ? 3 : 5} caption="" /></div>
      {note(tall ? { left: u(P * 0.5), right: u(P * 0.5), top: u(HANGER_ZONE + 64), bottom: u(P * 0.5) } : { left: u(P * 0.55), right: u(P * 0.55), top: '30%', bottom: u(P * 0.55) }, tall ? 38 : 30)}
    </>
  )
}

// ── 6. Scratch & Reveal: a metallic scratch-off panel hiding the number, the QR to reveal it.
function ScratchPanel({ c, t, sel, width, height, labelColor }: { c: Content; t: DesignTheme; sel: Sel; width: number; height: number; labelColor: string }) {
  const ask = askOf(c)
  const shown = c.leadGen ? ask.big : (c.price?.value || ask.big)
  // A lead magnet hides the number; a listing shows its real price, with only the edge still foiled.
  const at = c.leadGen ? 0 : 24
  const jag = `polygon(${48 + at}% 0, 100% 0, 100% 100%, ${43 + at}% 100%, ${46 + at}% 86%, ${42 + at}% 72%, ${47 + at}% 58%, ${43 + at}% 44%, ${48 + at}% 30%, ${44 + at}% 14%)`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(height * 0.12), flexShrink: 0 }}>
    <span style={{ fontFamily: t.fonts.label, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: u(Math.min(height * 0.14, width * 0.9 / Math.max(8, ask.tag.length) / 0.75)), color: labelColor, whiteSpace: 'nowrap' }}>{ask.tag}</span>
    <Pick id={c.leadGen ? c.title?.id : c.price?.id} sel={sel} style={{ position: 'relative', width: u(width), height: u(height), borderRadius: u(height * 0.12), overflow: 'hidden', background: PAPER, boxShadow: `inset 0 0 0 ${u(0.4)} rgba(0,0,0,0.12), 0 1cqmin 2.4cqmin rgba(0,0,0,0.3)`, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: u(width * 0.06) }}>
        <span style={{ fontFamily: t.fonts.display, fontWeight: 700, fontSize: u(Math.min(height * 0.5, width * (c.leadGen ? 0.9 : 0.62) / Math.max(5, shown.length) / 0.6)), lineHeight: 1.05, color: '#1E1D1B', whiteSpace: 'nowrap' }}>{shown}</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, clipPath: jag, background: `repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0 ${u(0.3)}, transparent ${u(0.3)} ${u(1.1)}), linear-gradient(120deg, #8E959E 0%, #DCE0E5 30%, #A9AFB7 48%, #F1F3F5 62%, #9AA1AA 82%, #C5CAD0 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: u(width * 0.06) }}>
        <span style={{ fontFamily: t.fonts.label, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: u(height * 0.13), color: 'rgba(60,64,70,0.6)', textShadow: '0 1px 0 rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.3, width: c.leadGen ? '46%' : '24%', marginBottom: u(height * 0.12) }}>{c.leadGen ? (c.qr ? 'Scan to reveal' : 'Call to reveal') : 'Scan'}</span>
      </div>
      <span aria-hidden style={{ position: 'absolute', right: u(width * 0.04), bottom: u(-height * 0.18), width: u(height * 0.5), height: u(height * 0.5), borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #F6E2A8, #C9A24D 55%, #8B6A2B)', boxShadow: '0 0.6cqmin 1.2cqmin rgba(0,0,0,0.35)', transform: 'rotate(-20deg)' }} />
    </Pick>
    </div>
  )
}

function Reveal(props: CompProps) {
  if (qrFallback(props)) return <Billboard {...props} />
  const { c, t, fam, S: S0, sel } = props
  const wide = fam === 'landscape' || fam === 'banner'
  const tall = fam === 'tall'
  const S = wide ? scaled(S0, 1) : S0
  const P = S.pad * (wide ? 0.85 : 1)
  const T = tones(t)
  const ink = T.onStrong
  const words = (k: number, align: 'left' | 'center') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5 * k), alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align }}>
      {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker * k} align={align} o={c.kicker.o} /></Pick>}
      {c.title && <Pick id={c.title.id} sel={sel}><Title text={c.title.text} t={t} ink={ink} size={S.title * 0.86 * k} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={16} /></Pick>}
      {c.leadGen ? c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} /> : c.sub && <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 0.9 * k} align={align} />}
    </div>
  )
  const glow = <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 50% at 70% 60%, ${hexA(ink.accent, 0.2)}, transparent 70%), ${T.strong}` }} />
  if (wide) {
    return (
      <>
        {glow}
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '34%', clipPath: 'polygon(14% 0, 100% 0, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', left: u(P), top: u(P * 0.75), bottom: u(P * 0.55), right: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap) }}>
          {words(1.05, 'left')}
          <div style={{ display: 'flex', alignItems: 'center', gap: u(4) }}>
            <ScratchPanel c={c} t={t} sel={sel} width={58} height={24} labelColor={ink.accent} />
            <ScanQr c={c} t={t} ink={ink} size={27} sel={sel} labelSize={S.kicker * 0.62} />
          </div>
          <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} scale={0.8} />
        </div>
      </>
    )
  }
  const photoPct = tall ? 30 : 27
  return (
    <>
      {glow}
      <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${photoPct}%`, clipPath: 'polygon(0 0, 100% 0, 100% 86%, 0 100%)' }} />
      <div style={{ position: 'absolute', left: u(P), right: u(P), top: `calc(${photoPct}% + ${u(S.gap)})`, bottom: u(P * 0.6), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: u(S.gap) }}>
        {words(tall ? 1.05 : (c.title?.text.length || 0) > 26 ? 1.1 : 1.22, 'center')}
        <ScratchPanel c={c} t={t} sel={sel} width={tall ? 84 : 76} height={tall ? 30 : 22} labelColor={ink.accent} />
        <div style={{ display: 'flex', alignItems: 'center', gap: u(4) }}>
          <ScanQr c={c} t={t} ink={ink} size={tall ? 40 : 28} sel={sel} corners={ink.accent} label={false} />
          {c.qr?.label && <Pick id={c.qr.id} sel={sel} style={{ maxWidth: u(tall ? 36 : 34) }}><div style={{ fontFamily: t.fonts.display, fontWeight: t.display.weight, textTransform: t.display.transform, fontSize: u(fit(c.qr.label, S.title * (tall ? 0.5 : 0.55), 14, 0.7)), lineHeight: 1.12, color: ink.ink }}>{c.qr.label}</div></Pick>}
        </div>
        <QrFoot fam={fam} c={c} t={t} ink={ink} S={S} sel={sel} align="center" />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// The classics, elevated (2026-10-08). Cinematic, Horizon and Seal on social posts set white type
// on a deep, photo-grade fade in every theme (a milky paper fade over a photo read cheap); the
// theme shows in the sign-off band, which carries a fine accent line along its top. The price is
// the hero of the details - large, the old price struck beside it - with the facts as stats.
// ---------------------------------------------------------------------------------------------
const deepTone = (t: DesignTheme) => (t.isDark ? t.scrim : '17,16,14')

function inkDeep(t: DesignTheme): Ink {
  return { ink: '#FFFFFF', muted: 'rgba(255,255,255,0.8)', accent: t.photoAccent, rule: 'rgba(255,255,255,0.3)', fill: t.photoAccent, fillInk: '#15161A', onPhoto: true, panel: `rgb(${deepTone(t)})` }
}

// `reach` = how far up (or across, for `side`) the fade climbs, in percent of the stage.
function deepScrim(t: DesignTheme, reach: number, side = false): string {
  const s = deepTone(t)
  const at = (k: number) => `${Math.round(reach * k)}%`
  if (side) {
    return [
      `linear-gradient(90deg, rgba(${s},0.9) 0%, rgba(${s},0.76) ${at(0.45)}, rgba(${s},0.32) ${at(0.78)}, rgba(${s},0) ${at(1)})`,
      `linear-gradient(0deg, rgba(${s},0.5) 0%, rgba(${s},0) 40%)`,
    ].join(', ')
  }
  return [
    `linear-gradient(0deg, rgba(${s},0.93) 0%, rgba(${s},0.84) ${at(0.32)}, rgba(${s},0.58) ${at(0.6)}, rgba(${s},0.2) ${at(0.84)}, rgba(${s},0) ${at(1)})`,
    `linear-gradient(180deg, rgba(${s},0.14) 0%, rgba(${s},0) 14%)`,
  ].join(', ')
}

// The price as the hero: a small accent label, the number large, the old price struck beside it.
function PriceHero({ c, t, ink, size, sel, align = 'left', label = true }: { c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; align?: 'left' | 'center' | 'right'; label?: boolean }) {
  const p = c.price
  if (!p) return null
  const items = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
  return (
    <Pick id={p.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: items, gap: u(size * 0.16), minWidth: 0, flexShrink: 0 }}>
      {label && p.label && <div style={{ fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', fontSize: u(Math.max(size * 0.22, 1.05)), color: ink.accent, whiteSpace: 'nowrap', paddingLeft: align === 'center' ? '0.22em' : undefined }}>{p.label}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: u(size * 0.3), flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <span style={{ fontFamily: t.fonts.price, fontWeight: t.price.weight, letterSpacing: t.price.tracking, fontSize: u(size * t.price.scale * p.o.k), lineHeight: 1, color: t.styleId === 'bold' ? ink.accent : ink.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...p.o.css }}>{p.value}</span>
        {p.previous && <span style={{ fontFamily: t.fonts.label, fontWeight: 500, fontSize: u(size * 0.34), color: ink.muted, textDecoration: 'line-through', textDecorationColor: ink.accent, whiteSpace: 'nowrap' }}>{p.previous}</span>}
      </div>
    </Pick>
  )
}

const factShort = (i: FactItem) => `${i.value}${SHORT_FACT[i.label] !== '' ? ` ${SHORT_FACT[i.label] ?? i.label.toUpperCase()}` : ''}`

// The facts as stats - the number set like the price, a small caps label under it, hairlines
// between. Five or more facts fall back to the one-line version so nothing runs off the edge.
function StatRow({ c, t, ink, size, sel, align = 'left' }: { c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; align?: 'left' | 'center' }) {
  const f = findFacts(c)
  if (!f) return null
  if (f.items.length > 4) return <FactsDots c={c} t={t} ink={ink} size={size * 0.9} sel={sel} align={align} />
  const k = f.o.k
  return (
    <Pick id={f.id} sel={sel}>
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
        {f.items.map((i, n) => (
          <div key={i.key} style={{ display: 'flex', alignItems: 'stretch' }}>
            {n > 0 && <Rule color={ink.rule} vertical style={{ margin: `0 ${u(size * 0.95)}` }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: u(size * 0.4) }}>
              <div style={{ fontFamily: t.styleId === 'bold' ? t.fonts.display : t.fonts.label, fontWeight: t.styleId === 'bold' ? 400 : 600, fontSize: u(size * 1.45 * k), lineHeight: 1, color: ink.ink, letterSpacing: '0.01em', whiteSpace: 'nowrap', fontVariantNumeric: 'lining-nums', ...f.o.css }}>{i.value}</div>
              <div style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: u(Math.max(size * 0.6 * k, 1.15)), color: ink.muted, whiteSpace: 'nowrap', lineHeight: 1 }}>{i.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Pick>
  )
}

// "5 BD • 4.5 BA • 5,200 SF" in spaced caps with small accent dots.
function FactsDots({ c, t, ink, size, sel, align = 'left' }: { c: Content; t: DesignTheme; ink: Ink; size: number; sel: Sel; align?: 'left' | 'center' | 'right' }) {
  const f = findFacts(c)
  if (!f) return null
  const s = size * f.o.k
  return (
    <Pick id={f.id} sel={sel}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: u(s * 0.4), justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', columnGap: u(s * 0.7), fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: u(s), color: ink.ink, lineHeight: 1.1, ...f.o.css }}>
        {f.items.map((i, k) => (
          <span key={i.key} style={{ display: 'inline-flex', alignItems: 'center', gap: u(s * 0.7), whiteSpace: 'nowrap' }}>
            {k > 0 && <span style={{ display: 'inline-block', width: u(s * 0.28), height: u(s * 0.28), borderRadius: '50%', background: ink.accent, flexShrink: 0 }} />}
            <span>{factShort(i)}</span>
          </span>
        ))}
      </div>
    </Pick>
  )
}

// Price | stats side by side when they fit, stacked when the price or the fact list is long.
function PriceStats({ c, t, ink, S, sel, align = 'left', k = 1, stack = false, label = true }: { c: Content; t: DesignTheme; ink: Ink; S: Sizes; sel: Sel; align?: 'left' | 'center'; k?: number; stack?: boolean; label?: boolean }) {
  const f = findFacts(c)
  if (!c.price && !f) return null
  const long = (c.price?.value.length || 0) > 10 || (f?.items.length || 0) > 3 || !!c.price?.previous
  const col = stack || long
  return (
    <div style={{ display: 'flex', flexDirection: col ? 'column' : 'row', alignItems: col ? (align === 'center' ? 'center' : 'flex-start') : 'flex-end', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: u(S.gap * (col ? 0.8 : 1.3) * k), maxWidth: '100%' }}>
      <PriceHero c={c} t={t} ink={ink} size={S.price * 1.18 * k} sel={sel} align={align} label={label} />
      {c.price && f && !col && <Rule color={ink.rule} vertical style={{ margin: `${u(S.facts * 0.2)} 0` }} />}
      <StatRow c={c} t={t} ink={ink} size={S.facts * 1.05 * k} sel={sel} align={align} />
    </div>
  )
}

// The sign-off band under the photo: the theme's own tone, a fine accent line along its top edge.
function SignBand({ c, t, fam, S, sel, strong = false }: { c: Content; t: DesignTheme; fam: DesignFamily; S: Sizes; sel: Sel; strong?: boolean }) {
  if (!c.agent && !c.logo) return null
  const T = tones(t)
  const ink = strong ? T.onStrong : inkOnBg(t)
  return (
    <div style={{ position: 'relative', zIndex: 2, flexShrink: 0, background: strong ? T.strong : t.bg, padding: `${u(S.pad * 0.62)} ${u(S.pad)} ${u(fam === 'story' ? 12 : S.pad * 0.62)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.6) }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: u(0.5), background: ink.accent }} />
      <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
      {c.leadGen && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
    </div>
  )
}

// A small accent dash - the pause between the place and the price.
function Dash({ ink, w = 9 }: { ink: Ink; w?: number }) {
  return <span style={{ display: 'block', width: u(w), height: u(0.32), background: ink.accent, flexShrink: 0 }} />
}

const socialFam = (c: Content, fam: DesignFamily) => !c.isPrint && (fam === 'square' || fam === 'portrait' || fam === 'story' || fam === 'landscape')

// ── Cinematic (social): the photo fills the frame, the story set over a deep fade - news, the
// address large, a dash, the price as the hero and the facts as stats.
function CinematicSocial({ c, t, fam, S: S0, sel }: CompProps) {
  const wide = fam === 'landscape'
  const story = fam === 'story'
  const tallish = story || fam === 'portrait'
  const S = wide ? scaled(S0, 0.86) : S0
  const P = S.pad
  const ink = inkDeep(t)
  const align: 'left' | 'center' = t.align === 'center' && !wide ? 'center' : 'left'
  const lead = c.leadGen
  const oh = findOpenHouse(c)
  const reach = wide ? 72 : story ? 64 : c.townOnly ? 60 : 76
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, background: deepScrim(t, reach, wide), pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, padding: `${u(story ? 14 : P)} ${u(P)} ${u(P * (c.townOnly ? 0.62 : 0.85))}`, display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-end', alignItems: align === 'center' ? 'center' : 'flex-start', zIndex: 2 }}>
            <div style={{ width: wide ? '58%' : '100%', display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: u(S.gap * 0.95) }}>
              {c.kicker && <Pick id={c.kicker.id} sel={sel}><Kicker text={c.kicker.text} t={t} ink={ink} size={S.kicker * 1.1} align={align} o={c.kicker.o} /></Pick>}
              {c.title && (
                <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.42), width: '100%', alignItems: align === 'center' ? 'center' : 'flex-start' }}>
                  <Title text={c.title.text} t={t} ink={ink} size={S.title * (lead ? 1.02 : 1.14)} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={lead ? 26 : 17} style={{ textShadow: '0 0.3cqmin 2.4cqmin rgba(0,0,0,0.28)' }} />
                  {c.sub && (c.title.isAddress
                    ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 1.12} align={align} />
                    : <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.1} align={align} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />)}
                </Pick>
              )}
              {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 1.08} align={align} o={oh.o} /></Pick>}
              {!lead && (c.price || findFacts(c)) && (
                <>
                  <Dash ink={ink} />
                  <PriceStats c={c} t={t} ink={ink} S={S} sel={sel} align={align} stack={tallish} />
                </>
              )}
              {lead && <Details c={c} t={t} ink={ink} S={S} align={align} sel={sel} only={['cta']} />}
            </div>
          </div>
        </div>
        <SignBand c={c} t={t} fam={fam} S={S} sel={sel} />
      </div>
      <LuxFrame t={t} ink={inkOnBg(t)} inset={P * 0.45} />
    </>
  )
}

// ── Horizon (social): the photo fills the frame; the details sit low on a horizon line - the news
// riding the line, the address on the left, the price over the facts on the right.
function HorizonSocial({ c, t, fam, S: S0, sel }: CompProps) {
  const wide = fam === 'landscape'
  const story = fam === 'story'
  const S = wide ? scaled(S0, 0.86) : S0
  const P = S.pad
  const ink = inkDeep(t)
  const lead = c.leadGen
  const facts = findFacts(c)
  const oh = findOpenHouse(c)
  const reach = story ? 58 : c.townOnly ? 50 : 60
  const kick = c.kicker && (
    <div style={{ display: 'flex', alignItems: 'center', gap: u(S.gap * 0.8) }}>
      <Label text={c.kicker.text} t={t} ink={ink} size={S.kicker * 0.98} color={ink.accent} id={c.kicker.id} sel={sel} style={{ letterSpacing: '0.26em' }} />
      <span style={{ flex: 1, height: hair, background: 'rgba(255,255,255,0.42)' }} />
    </div>
  )
  const words = (
    <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.45) }}>
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.32) }}>
          <Title text={c.title.text} t={t} ink={ink} size={S.title * (lead ? 0.86 : story ? 1.02 : 0.9)} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={lead ? 24 : story ? 16 : 17} />
          {c.sub && (c.title.isAddress
            ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 1.02} align="left" />
            : <Lede text={c.sub.text} t={t} ink={ink} size={S.body} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />)}
        </Pick>
      )}
      {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 0.95} align="left" o={oh.o} /></Pick>}
      {lead && <Details c={c} t={t} ink={ink} S={scaled(S, 0.9)} align="left" sel={sel} only={['cta']} />}
    </div>
  )
  const right = !lead && (c.price || facts) && (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: story ? 'flex-start' : 'flex-end', gap: u(S.gap * 0.6), maxWidth: story ? '100%' : wide ? '42%' : '48%' }}>
      <PriceHero c={c} t={t} ink={ink} size={S.price * (story ? 1.15 : 0.98)} sel={sel} align={story ? 'left' : 'right'} />
      <FactsDots c={c} t={t} ink={ink} size={S.facts * (story ? 0.98 : 0.84)} sel={sel} align={story ? 'left' : 'right'} />
    </div>
  )
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, background: deepScrim(t, reach), pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `0 ${u(P)} ${u(P * (c.townOnly ? 0.6 : story ? 1 : 0.8))}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.95), zIndex: 2 }}>
            {kick}
            {story ? (
              <>
                {words}
                {right}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(S.gap * 1.3) }}>
                {words}
                {right && <Rule color="rgba(255,255,255,0.32)" vertical />}
                {right}
              </div>
            )}
          </div>
        </div>
        <SignBand c={c} t={t} fam={fam} S={S} sel={sel} />
      </div>
      <LuxFrame t={t} ink={inkOnBg(t)} inset={P * 0.45} />
    </>
  )
}

// ── Seal (social): the photo full-bleed, a black-and-gold stamp with the news, the address set
// low over a deep fade, the price beside the stats under a hairline.
function SealSocial({ c, t, fam, S: S0, sel }: CompProps) {
  const land = fam === 'landscape'
  const story = fam === 'story'
  const S = land ? scaled(S0, 0.9) : S0
  const P = S.pad
  const ink = inkDeep(t)
  const lead = c.leadGen
  const oh = findOpenHouse(c)
  const sealSize = story ? 44 : land ? 40 : fam === 'portrait' ? 32 : 33
  const reach = land ? 72 : story ? 54 : c.townOnly ? 50 : 62
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: deepScrim(t, reach, land), pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', zIndex: 3, ...(story ? { top: '14%', right: u(P * 0.8) } : land ? { top: u(P * 0.8), right: u(P * 0.9) } : { top: u(P * 0.7), right: u(P * 0.7) }) }}>
          <SealBadge c={c} t={t} size={sealSize} sel={sel} />
        </div>
        <div style={{ position: 'absolute', left: u(P), right: land ? '42%' : u(P), bottom: u(P * (c.townOnly ? 0.6 : story ? 1 : 0.8)), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.8), zIndex: 2 }}>
          {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 1.05} align="left" o={oh.o} /></Pick>}
          {c.title && (
            <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.38) }}>
              <Title text={c.title.text} t={t} ink={ink} size={S.title * (lead ? 0.95 : 1.06)} align="left" o={c.title.o} placeholder={c.title.placeholder} maxChars={lead ? 24 : 17} style={{ textShadow: '0 0.3cqmin 2.4cqmin rgba(0,0,0,0.28)' }} />
              {c.sub && (c.title.isAddress
                ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 1.08} align="left" />
                : <Lede text={c.sub.text} t={t} ink={ink} size={S.body} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />)}
            </Pick>
          )}
          {!lead && (c.price || findFacts(c)) && (
            <div style={{ borderTop: `${hair} solid rgba(255,255,255,0.32)`, paddingTop: u(S.gap * 0.95) }}>
              <PriceStats c={c} t={t} ink={ink} S={S} sel={sel} k={0.9} stack={story} label={false} />
            </div>
          )}
          {lead && <Details c={c} t={t} ink={ink} S={S} align="left" sel={sel} only={['cta']} />}
        </div>
      </div>
      <SignBand c={c} t={t} fam={fam} S={S} sel={sel} strong />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Arch + Swiss (2026-10-08). Two more art directions for every social size, the email header and
// the presentation slide - as unlike each other (and everything above) as possible: one calm and
// architectural, one loud and typographic. Both carry a full sign-off on print too.
// ---------------------------------------------------------------------------------------------

// ── Arch: the home framed in a tall arched window - a fine accent outline echoing it with a keystone
// diamond and a sill line, the story set beneath (or beside) in quiet, centered type.
function ArchWindow({ c, t, sel, w, h, gold }: { c: Content; t: DesignTheme; sel: Sel; w: number; h: number; gold: string }) {
  const g = Math.max(1.2, w * 0.03) // the outline's offset from the photo
  return (
    <div style={{ position: 'relative', width: u(w), height: u(h), flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: u(-g), right: u(-g), top: u(-g), bottom: u(-g), borderRadius: `${u(w / 2 + g)} ${u(w / 2 + g)} 0 0`, border: `${hair} solid ${hexA(gold, 0.85)}`, borderBottom: 'none', pointerEvents: 'none' }} />
      <span style={{ position: 'absolute', left: '50%', top: u(-g), width: u(Math.max(1.3, w * 0.035)), height: u(Math.max(1.3, w * 0.035)), background: gold, transform: 'translate(-50%, -50%) rotate(45deg)' }} />
      <span style={{ position: 'absolute', left: u(-g * 2.6), right: u(-g * 2.6), bottom: u(-g), height: u(0.32), background: gold }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: `${u(w / 2)} ${u(w / 2)} 0 0`, overflow: 'hidden', boxShadow: '0 1.4cqmin 4cqmin rgba(0,0,0,0.2)' }}>
        <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  )
}

function Diamond({ size, color }: { size: number; color: string }) {
  return <span style={{ display: 'inline-block', width: u(size), height: u(size), background: color, transform: 'rotate(45deg)', flexShrink: 0 }} />
}

function Arch({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  const story = fam === 'story'
  const tall = fam === 'tall'
  const portrait = fam === 'portrait'
  const banner = fam === 'banner'
  const wide = fam === 'landscape' || banner
  const post45 = fam === 'square' && ar < 0.95
  const vertical = story || tall || portrait || post45
  const S = banner ? scaled(S0, 0.72) : wide ? scaled(S0, c.isPrint ? 0.82 : 0.88) : S0
  const P = S.pad
  const ink = inkOnBg(t)
  const gold = t.isDark ? t.photoAccent : t.accent
  const paper = t.isDark ? t.bg : t.surface
  const lead = c.leadGen
  const oh = findOpenHouse(c)
  const news = (lead ? c.kicker?.text : newsWord(c)) || ''
  const H = 100 / Math.min(ar, 1) // canvas height in cqmin

  const words = (align: 'left' | 'center', k: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align, gap: u(S.gap * 0.72 * k), width: '100%', minWidth: 0 }}>
      {news && (
        <Pick id={lead ? c.kicker?.id : c.big?.id || c.kicker?.id} sel={sel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: u(S.kicker * 0.7 * k) }}>
            <Diamond size={S.kicker * 0.36 * k} color={gold} />
            <span style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.36em', paddingLeft: '0.36em', fontSize: u(fit(news, S.kicker * 0.96 * k, 16, 0.6)), color: gold, whiteSpace: 'nowrap' }}>{news}</span>
            <Diamond size={S.kicker * 0.36 * k} color={gold} />
          </div>
        </Pick>
      )}
      {c.title && (
        <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: u(S.gap * 0.32 * k), width: '100%' }}>
          <Title text={c.title.text} t={t} ink={ink} size={S.title * (lead ? 0.92 : 1) * k} align={align} o={c.title.o} placeholder={c.title.placeholder} maxChars={lead ? 22 : 16} />
          {c.sub && (c.title.isAddress
            ? <Sub text={c.sub.text} t={t} ink={ink} size={S.sub * 1.02 * k} align={align} />
            : <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.02 * k} align={align} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '96%' }} />)}
        </Pick>
      )}
      {oh && <Pick id={oh.id} sel={sel}><OpenHouseLine date={oh.date} time={oh.time} t={t} ink={ink} size={S.facts * 0.98 * k} align={align} o={oh.o} /></Pick>}
      {!lead && (c.price || findFacts(c)) && (
        <>
          <span style={{ display: 'block', width: u(7 * k), height: hair, background: gold, margin: `${u(S.gap * 0.15)} 0` }} />
          <PriceHero c={c} t={t} ink={{ ...ink, accent: gold }} size={S.price * 1.02 * k} sel={sel} align={align} />
          <FactsDots c={c} t={t} ink={{ ...ink, accent: gold }} size={S.facts * 0.86 * k} sel={sel} align={align} />
        </>
      )}
      {lead && <Details c={c} t={t} ink={ink} S={scaled(S, k)} align={align} sel={sel} only={['cta']} />}
      {c.isPrint && !lead && (portrait || tall) && <div style={{ width: '94%' }}><PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align={align} clamp={tall ? 3 : 2} /></div>}
    </div>
  )
  const signOff = (compact = false) => c.isPrint
    ? <PrintSignOff c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} align={vertical && !tall ? 'left' : 'left'} />
    : (c.agent || c.logo) && (
      <div style={{ width: '100%', borderTop: `${hair} solid ${hexA(gold, 0.5)}`, paddingTop: u(S.gap * 0.75), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} compact={compact} />
        {lead && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const bg = (x: string, y: string) => (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(46% 40% at ${x} ${y}, ${hexA(gold, t.isDark ? 0.2 : 0.16)}, transparent 72%), repeating-linear-gradient(90deg, ${hexA(ink.ink, 0.018)} 0 1px, transparent 1px 4px), ${paper}` }} />
  )

  if (vertical) {
    const top = story ? 19.5 : tall ? HANGER_ZONE + 3 : P * 1.05
    const bottom = story ? 19.5 : P * 0.8
    const archW = story ? (lead ? 52 : 56) : tall ? 60 : post45 ? 48 : 50
    const archH = story ? (lead ? 54 : 62) : tall ? 58 : post45 ? 54 : 50
    return (
      <>
        {bg('50%', `${(top + archH / 2) / H * 100}%`)}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(top)} ${u(P)} ${u(bottom)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(S.gap * 1.1) }}>
          <ArchWindow c={c} t={t} sel={sel} w={archW} h={archH} gold={gold} />
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: u(S.gap * 0.6) }}>
            {words('center', story ? 1.08 : tall ? 1.05 : post45 ? 1 : 0.98)}
          </div>
          {signOff()}
        </div>
      </>
    )
  }

  // Square, wide posts, slides, the email header: the arch on the left, the story beside it.
  const archH = 100 - P * (banner ? 1.5 : 2) - (fam === 'square' ? 0 : 0)
  const archW = banner ? archH * 0.62 : fam === 'square' ? 38 : archH * 0.66
  return (
    <>
      {bg(`${(P + archW / 2) / (100 * Math.max(ar, 1)) * 100}%`, '55%')}
      <div style={{ position: 'absolute', inset: 0, padding: `${u(P * (banner ? 0.75 : 1))} ${u(P)} ${u(P * (banner ? 0.75 : 1))} ${u(P * 1.1)}`, display: 'flex', gap: u(P * (banner ? 1.2 : 1)), alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: u(2) }}>
          <ArchWindow c={c} t={t} sel={sel} w={archW} h={archH - 2} gold={gold} />
        </div>
        {banner ? (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: u(P) }}>
            <div style={{ flex: 1, minWidth: 0 }}>{words('left', 1.25)}</div>
            {(c.agent || c.logo) && <div style={{ flex: '0 0 30%', minWidth: 0, borderLeft: `${hair} solid ${hexA(gold, 0.5)}`, paddingLeft: u(P * 0.8) }}><AgentBar c={c} t={t} ink={ink} S={scaled(S, 1.3)} sel={sel} fam={fam} compact /></div>}
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: u(S.gap) }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{words('center', fam === 'square' ? 1.02 : 1.08)}</div>
            {signOff(true)}
          </div>
        )}
      </div>
    </>
  )
}

// ── Swiss: an International-style poster - the news set huge in a heavy grotesk across the grid,
// the photo as a hard-edged block, the numbers in a ruled data table, an accent square as the mark.
function Swiss({ c, t, fam, S: S0, sel, ar = 1 }: CompProps) {
  const story = fam === 'story'
  const tall = fam === 'tall'
  const portrait = fam === 'portrait'
  const banner = fam === 'banner'
  const land = fam === 'landscape'
  const post45 = fam === 'square' && ar < 0.95
  const S = banner ? scaled(S0, 0.72) : land ? scaled(S0, c.isPrint ? 0.82 : 0.88) : S0
  const P = S.pad
  const W = 100 * Math.max(ar, 1) // canvas width in cqmin
  const ink = inkOnBg(t)
  const accent = t.isDark ? t.photoAccent : t.accent
  const bold = t.styleId === 'bold'
  const lead = c.leadGen
  const oh = findOpenHouse(c)
  const facts = findFacts(c)
  const news = newsWord(c)
  const heavy: CSSProperties = { fontFamily: bold ? t.fonts.display : t.fonts.label, fontWeight: bold ? 400 : 800, textTransform: 'uppercase', letterSpacing: bold ? '0' : '-0.04em', lineHeight: 0.88, color: ink.ink }
  const charW = bold ? 0.46 : 0.64
  const giantText = (lead ? (c.title?.text || news) : news).toUpperCase()

  const giant = (room: number, maxLines: number, cap: number) => {
    const lines = splitLines(giantText, maxLines)
    const longest = Math.max(4, ...lines.map(l => l.length))
    const fs = Math.min(cap, room / longest / charW)
    return (
      <Pick id={lead ? c.title?.id : c.big?.id || c.kicker?.id} sel={sel}>
        <div style={{ ...heavy, fontSize: u(fs) }}>
          {lines.map((l, i) => <div key={i} style={{ whiteSpace: 'nowrap', color: i === lines.length - 1 && lines.length > 1 ? accent : ink.ink }}>{l}</div>)}
        </div>
      </Pick>
    )
  }
  const num = c.title?.isAddress && !c.townOnly ? (c.title.text.match(/^\s*(\d+[A-Za-z]?)/)?.[1] || '') : ''
  const indexRow = (size: number) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(size), borderBottom: `${u(0.42)} solid ${ink.ink}`, paddingBottom: u(size * 0.7), fontFamily: t.fonts.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(size), color: ink.ink, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: u(size * 0.8) }}>
        <span style={{ display: 'inline-block', width: u(size * 1.15), height: u(size * 1.15), background: accent }} />
        {lead ? (c.kicker?.text || 'For homeowners') : `N° ${num || '01'}`}
      </span>
      <span style={lead ? { color: ink.ink, fontWeight: 800, minWidth: 0, textAlign: 'right', whiteSpace: 'normal', lineHeight: 1.3, fontSize: `${Math.max(0.6, Math.min(1, 22 / Math.max(1, (c.agent?.brokerage || '').length)))}em` } : { color: ink.muted, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{lead ? (c.agent?.brokerage || '') : placeName(c)}</span>
    </div>
  )
  const address = (k: number) => c.title && !lead && (
    <Pick id={c.title.id} sel={sel} style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.25 * k), minWidth: 0 }}>
      <div style={{ fontFamily: t.fonts.label, fontWeight: 700, fontSize: u(fit(c.title.text, S.title * 0.5 * k, 20, 0.7)), lineHeight: 1.1, letterSpacing: '-0.01em', color: ink.ink, textWrap: 'balance' as any }}>{c.title.text}</div>
      {c.sub && <div style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: u(S.sub * 0.72 * k), color: ink.muted }}>{c.sub.text}</div>}
    </Pick>
  )
  type Cell = { key: string; label: string; value: string; id?: string; prev?: string | null; big?: boolean; span?: boolean }
  const cells: Cell[] = []
  if (oh) cells.push({ key: 'oh', label: 'Open house', value: [oh.date, oh.time].filter(Boolean).join(' · '), id: oh.id, span: true })
  if (c.price) cells.push({ key: 'price', label: c.price.label || 'Price', value: c.price.value, id: c.price.id, prev: c.price.previous, big: true })
  for (const i of facts?.items || []) cells.push({ key: i.key, label: i.label, value: i.value, id: facts!.id })
  const table = (cols: string, size: number, priceSpan = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: u(size * 1.2), rowGap: u(size * 0.9), minWidth: 0 }}>
      {cells.map(cell => (
        <Pick key={cell.key} id={cell.id} sel={sel} style={{ gridColumn: cell.span || (cell.big && priceSpan) ? '1 / -1' : undefined, borderTop: `${hair} solid ${hexA(ink.ink, 0.5)}`, paddingTop: u(size * 0.5), minWidth: 0 }}>
          <div style={{ fontFamily: t.fonts.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: u(Math.max(size * 0.5, 1)), color: ink.muted, whiteSpace: 'nowrap', marginBottom: u(size * 0.4) }}>{cell.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: u(size * 0.5), flexWrap: 'wrap' }}>
            <span style={{ fontFamily: bold ? t.fonts.display : t.fonts.label, fontWeight: bold ? 400 : 700, fontSize: u(size * (cell.big ? 1.75 : cell.span ? 0.95 : 1.4)), lineHeight: 1, letterSpacing: '-0.02em', color: cell.big ? accent : ink.ink, whiteSpace: cell.span ? 'normal' : 'nowrap', fontVariantNumeric: 'lining-nums tabular-nums' }}>{cell.value}</span>
            {cell.prev && <span style={{ fontFamily: t.fonts.label, fontSize: u(size * 0.62), color: ink.muted, textDecoration: 'line-through' }}>{cell.prev}</span>}
          </div>
        </Pick>
      ))}
    </div>
  )
  const pitch = (k: number) => lead && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.7 * k), alignItems: 'flex-start' }}>
      {c.sub && <Lede text={c.sub.text} t={t} ink={ink} size={S.body * 1.05 * k} align="left" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />}
      <Details c={c} t={t} ink={ink} S={scaled(S, k)} align="left" sel={sel} only={['cta']} />
    </div>
  )
  const photo = (style: CSSProperties) => <Photo photo={c.photos[0]} t={t} sel={sel} pickId={c.heroId || c.galleryId} style={style} />
  const signOff = (compact = false) => c.isPrint
    ? <PrintSignOff c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} />
    : (c.agent || c.logo) && (
      <div style={{ width: '100%', borderTop: `${u(0.42)} solid ${ink.ink}`, paddingTop: u(S.gap * 0.75), display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.5) }}>
        <AgentBar c={c} t={t} ink={ink} S={S} sel={sel} fam={fam} compact={compact} />
        {lead && <FinePrint c={c} ink={ink} t={t} size={S.fine} />}
      </div>
    )
  const paper = <div style={{ position: 'absolute', inset: 0, background: t.bg }} />

  if (banner) {
    return (
      <>
        {paper}
        {photo({ position: 'absolute', left: 0, top: 0, bottom: 0, width: '27%' })}
        <div style={{ position: 'absolute', left: '27%', right: 0, top: 0, bottom: 0, padding: `${u(P * 0.8)} ${u(P)}`, display: 'flex', gap: u(P * 1.1) }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap * 0.6) }}>
            {indexRow(S.kicker * 0.9)}
            {giant(W * 0.4 - P, lead ? 2 : 1, 22)}
            {lead ? pitch(1.1) : address(1.3)}
          </div>
          <div style={{ flex: '0 0 30%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap) }}>
            {!lead && table('1fr 1fr 1fr', S.facts * 1.25, true)}
            {(c.agent || c.logo) && <AgentBar c={c} t={t} ink={ink} S={scaled(S, 1.1)} sel={sel} fam={fam} compact />}
          </div>
        </div>
      </>
    )
  }

  if (land) {
    return (
      <>
        {paper}
        {photo({ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%' })}
        <div style={{ position: 'absolute', right: '50%', top: 0, bottom: 0, width: u(1.1), background: accent }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', padding: `${u(P * 0.85)} ${u(P * 1.1)} ${u(P * 0.8)} ${u(P)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
          {indexRow(S.kicker * 0.85)}
          {giant(W * 0.5 - P * 2.1, lead ? 4 : 2, lead ? 13 : 19)}
          {address(1.05)}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {lead ? pitch(1) : table('1.55fr 1fr 1fr 1fr', S.facts * 0.92)}
          </div>
          {signOff(true)}
        </div>
      </>
    )
  }

  const sq = fam === 'square' && !post45
  if (sq && lead) {
    return (
      <>
        {paper}
        <div style={{ position: 'absolute', inset: 0, padding: `${u(P * 0.9)} ${u(P)} ${u(P * 0.8)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.9) }}>
          {indexRow(S.kicker * 0.85)}
          {giant(100 - P * 2, lead ? 3 : giantText.length > 13 ? 2 : 1, lead ? 11 : 15)}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: u(S.gap * 1.2) }}>
            <div style={{ flex: '0 0 54%', position: 'relative' }}>
              {photo({ position: 'absolute', inset: 0 })}
              <span style={{ position: 'absolute', left: 0, bottom: 0, width: u(3.2), height: u(3.2), background: accent }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: u(S.gap * 0.8) }}>
              {address(0.95)}
              {lead ? pitch(0.95) : table('1fr 1fr', S.facts * 1.12, true)}
            </div>
          </div>
          {signOff()}
        </div>
      </>
    )
  }

  // Portrait post, flyer, Story, door hanger: giant type over a full-width photo block, the table under it.
  const top = story ? 19.5 : tall ? HANGER_ZONE + 2 : P * 0.9
  const bottom = story ? 19.5 : P * 0.8
  const cols = tall ? '1fr 1fr 1fr' : story ? '1fr 1fr 1fr' : '1.5fr 1fr 1fr 1fr'
  return (
    <>
      {paper}
      <div style={{ position: 'absolute', inset: 0, padding: `${u(top)} ${u(P)} ${u(bottom)}`, display: 'flex', flexDirection: 'column', gap: u(S.gap * 0.95) }}>
        {indexRow(S.kicker * 0.85)}
        {giant(100 - P * 2, lead ? 4 : sq && giantText.length <= 13 ? 1 : 2, lead ? (story ? 15 : 13) : story ? 20 : tall ? 22 : sq ? 14 : post45 ? 15 : 19)}
        <div style={{ flex: 1, minHeight: u(18), position: 'relative' }}>
          {photo({ position: 'absolute', inset: 0 })}
          <span style={{ position: 'absolute', right: 0, bottom: 0, width: u(4), height: u(4), background: accent }} />
        </div>
        {address(story ? 1.15 : 1)}
        {lead ? pitch(story ? 1.15 : 1) : table(cols, S.facts * (story ? 1.05 : 0.95), cols !== '1.5fr 1fr 1fr 1fr')}
        {c.isPrint && !lead && <PrintStory c={c} t={t} ink={ink} S={S} sel={sel} align="left" clamp={2} />}
        {signOff()}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------
function DesignCanvasImpl({ blocks, ctx, exportRef, selectedBlockId, onSelectBlock }: DesignCanvasProps) {
  const t = resolveDesignTheme(ctx.styleId, ctx.colorMode, ctx.brandKit)
  const fam = formatFamily(ctx.format)
  const c = buildContent(blocks, ctx)
  const S = scaled(BASE_SIZES[fam], densityScale(c))
  const composition: DesignCompositionId = ctx.composition || compositionFromLegacy(ctx.layoutHints, ctx.format, blocks)
  const sel: Sel = { selectedBlockId, onSelectBlock }
  const props: CompProps = { c, t, fam, S, sel, ar: ctx.format.aspectRatio }
  const legacySplitLeft = ctx.layoutHints?.splitSide === 'left'

  return (
    <div
      ref={exportRef}
      data-design-canvas=""
      style={{
        position: 'relative', width: '100%', aspectRatio: String(ctx.format.aspectRatio), overflow: 'hidden',
        containerType: 'size' as any, background: t.bg, color: t.ink, fontFamily: t.fonts.body,
        WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility', fontKerning: 'normal',
      }}
    >
      {composition === 'cinematic' && <Cinematic {...props} />}
      {composition === 'horizon' && <Horizon {...props} />}
      {composition === 'framed' && <Framed {...props} />}
      {composition === 'split' && <Split {...props} photoFirst={legacySplitLeft} />}
      {composition === 'collage' && <Collage {...props} />}
      {composition === 'statement' && <Statement {...props} />}
      {composition === 'band' && <Band {...props} />}
      {composition === 'card' && <Card {...props} />}
      {composition === 'magazine' && <Magazine {...props} />}
      {composition === 'mosaic' && <Mosaic {...props} />}
      {composition === 'seal' && <Seal {...props} />}
      {composition === 'luxe' && <Luxe {...props} />}
      {composition === 'keepsake' && <Keepsake {...props} />}
      {composition === 'billboard' && <Billboard {...props} />}
      {composition === 'slant' && <Slant {...props} />}
      {composition === 'postage' && <Postage {...props} />}
      {composition === 'filmstrip' && <Filmstrip {...props} />}
      {composition === 'ticket' && <Ticket {...props} />}
      {composition === 'pricetag' && <PriceTag {...props} />}
      {composition === 'scango' && <ScanGo {...props} />}
      {composition === 'bullseye' && <Bullseye {...props} />}
      {composition === 'note' && <NeighborNote {...props} />}
      {composition === 'reveal' && <Reveal {...props} />}
      {composition === 'arch' && <Arch {...props} />}
      {composition === 'swiss' && <Swiss {...props} />}
    </div>
  )
}

// Memoized: the editor re-renders on every card open / hover / save tick - the design itself only
// redraws when its blocks, context or selection actually change (the editor keeps ctx stable).
const DesignCanvas = memo(DesignCanvasImpl)
export default DesignCanvas
