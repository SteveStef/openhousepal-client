// Turns a saved Email Signature config + the agent's (live) Agent Hub config into the inputs of
// buildDesignPreviewHtml (lib/signaturePreview.ts) - the "Site Version" of the signature. Shared by
// the Studio editor's live preview and the public card that closes every blog article, so the two
// can never drift apart.

import { API_BASE_URL } from '@/lib/api-service'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'
import { epochDayIndex, formatSaleStatus, getEligibleListings, getSalesRotationPool, getSaleSummary } from '@/lib/agentSales'
import { metalOf, LUXE_METALS } from '@/lib/luxeMetals'

export const SIGNATURE_FONT_OPTIONS: { id: string; label: string; stack: string }[] = [
  { id: 'system', label: 'System', stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` },
  { id: 'arial', label: 'Classic', stack: `Arial, Helvetica, sans-serif` },
  { id: 'georgia', label: 'Editorial Serif', stack: `Georgia, "Times New Roman", Times, serif` },
  { id: 'trebuchet', label: 'Friendly', stack: `"Trebuchet MS", Tahoma, sans-serif` },
]
export const signatureFontStack = (id: string) => SIGNATURE_FONT_OPTIONS.find(f => f.id === id)?.stack || SIGNATURE_FONT_OPTIONS[0].stack

export const fmtMoney = (value?: number) => (value ? `$${Math.round(value).toLocaleString()}` : '')

// Same M/K/B convention as _fmt_compact_money in email_signature_service.py.
export const fmtCompactMoney = (value?: number) => {
  if (!value) return '$0'
  if (value >= 1_000_000_000) { const b = value / 1_000_000_000; return `$${b === Math.trunc(b) ? b : Math.round(b * 100) / 100}B` }
  if (value >= 1_000_000) { const m = value / 1_000_000; return `$${m === Math.trunc(m) ? m : Math.round(m * 100) / 100}M` }
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${Math.round(value).toLocaleString()}`
}

export function socialUrlsFrom(hubConfig: any): Record<string, string> {
  const links: any[] = hubConfig?.socialLinks || []
  const result: Record<string, string> = {}
  for (const net of ['website', 'instagram', 'facebook', 'youtube', 'tiktok']) {
    const link = links.find(l => l && l.id === net && l.enabled && String(l.url || '').trim())
    if (link) {
      const url = String(link.url).trim()
      result[net] = url.startsWith('http') ? url : `https://${url}`
    }
  }
  return result
}

export function buildSignatureSiteInput({ config, hubConfig, agentHubSlug, ownerId, forms, fallbackName = '', fallbackPhoto = '', rotate }: {
  config: any
  hubConfig: any
  agentHubSlug: string
  ownerId?: string
  forms: { form_type: string; slug: string }[]
  fallbackName?: string
  fallbackPhoto?: string
  /** The page this Site Version sits on (blog, Spotlight): `towns` = what it's about - that
   *  town's listings and sales go first in the rotation. */
  rotate?: { towns?: string[] } | null
}) {
  const profile = hubConfig.profile || {}
  const contact = hubConfig.contact || {}
  const f = config.fields || {}
  const on = (k: string) => !!f[k]?.include
  const agentHubUrl = agentHubSlug ? openHousePalPublicUrl(`/${agentHubSlug}`) : ''
  const socialUrls = socialUrlsFrom(hubConfig)
  const displayName = (profile.name || '').trim() || fallbackName

  const identity = {
    name: on('name') ? displayName : '',
    title: on('title') ? (profile.title || '') : '',
    company: on('company') ? (profile.brokerage || '') : '',
    team: on('team') ? (profile.team || '') : '',
    headshot: on('headshot') ? (hubConfig.profilePhotoUrl || fallbackPhoto || '') : '',
    headshotPosition: hubConfig.profilePhotoPosition && typeof hubConfig.profilePhotoPosition.x === 'number'
      ? { x: hubConfig.profilePhotoPosition.x, y: hubConfig.profilePhotoPosition.y }
      : undefined,
    phone: on('phone') ? (contact.call || '') : '',
    email: on('email') ? (contact.email || '') : '',
    website: '',
    agentHubUrl: on('agentHubUrl') ? agentHubUrl : '',
    showVerifiedBadge: !!config.showVerifiedBadge,
    vcardUrl: agentHubSlug ? `${API_BASE_URL}/agent-hub/public/${encodeURIComponent(agentHubSlug)}/vcard` : '',
  }

  const socials = (['website', 'instagram', 'facebook', 'youtube', 'tiktok'] as const)
    .filter(net => on(net) && socialUrls[net])
    .map(net => ({ network: net, url: socialUrls[net] }))

  const buttons: { label: string; url: string }[] = []
  if (identity.agentHubUrl) buttons.push({ label: 'My Agent Hub →', url: identity.agentHubUrl })
  for (const b of config.ctaButtons || []) {
    if (!b.enabled || !String(b.label || '').trim()) continue
    const form = b.formType ? forms.find(x => x.form_type === b.formType) : null
    const url = form ? openHousePalPublicUrl(`/${agentHubSlug}/${form.slug}`) : b.url
    if (!url) continue
    buttons.push({ label: b.label, url })
  }

  // A recent sale drawn as the featured-listing card (status Sold, "Recent sale").
  const saleCard = (item: any) => ({
    image: item.image || '', kicker: 'RECENT SALE', address: (item.address || '').split(',')[0].trim(),
    location: [item.city, item.state].filter(Boolean).join(', '), price: fmtMoney(item.price), status: 'Sold',
    beds: item.beds, baths: item.baths, sqft: item.sqft, acres: item.acres,
    href: agentHubUrl ? `${agentHubUrl}/sales` : '',
  })
  let listing: any = null
  let saleCards: { image: string; city: string; price: string }[] | null = null
  let listingHref = ''
  let salesHref = ''
  const banner = config.banner || {}
  if (config.blockVisibility?.banner) {
    const eligibleListings = banner.showFeaturedListing ? getEligibleListings(hubConfig.myListings || []).filter((l: any) => l.visible !== false) : []
    if (eligibleListings.length) {
      const item: any = eligibleListings[epochDayIndex() % eligibleListings.length]
      listing = {
        image: item.image || '', kicker: 'FEATURED LISTING', address: (item.address || '').split(',')[0].trim(),
        location: [item.city, item.state].filter(Boolean).join(', '), price: fmtMoney(item.price), status: formatSaleStatus(item.status || 'Active'),
        beds: item.beds, baths: item.baths, sqft: item.sqft, acres: item.acres,
      }
      // The stable redirect decides at click time (Spotlight, else the plain property page); without an
      // owner id, the listing's own resolved link, else the hub's Sales page where current listings lead.
      listingHref = ownerId ? `${API_BASE_URL}/email-signature/go/${ownerId}/featured` : (item.listingLinkUrl || (agentHubUrl ? `${agentHubUrl}/sales` : ''))
    } else if (banner.showRecentSales) {
      const pool = getSalesRotationPool(hubConfig.recentSales || [], hubConfig.salesMinPrice || 0)
      salesHref = agentHubUrl ? `${agentHubUrl}/sales` : ''
      // 3+ sales: the row of three. 1 or 2: the featured-listing card (two take turns - the
      // rotation below), like the email's render_sale_feature - one card in a 3-slot row looked empty.
      if (pool.length >= 3) saleCards = pool.slice(0, 3).map((s: any) => ({ image: s.image || '', city: s.city || '', price: fmtMoney(s.price) }))
      else if (pool.length) { listing = saleCard(pool[0]); listingHref = salesHref }
    }
  }

  // Rotation (every Site Version - editor preview, blogs, Spotlight): the featured slot cycles
  // through the agent's top 5 listings by price, one slide per ~6s while it's on screen. With 3 or
  // fewer listings a "Recent Sales" slide joins in (the most recent sales, priciest 3 first).
  // On a page about a town (`rotate.towns`): that town's listings lead, and that town's sales join
  // whatever the listing count - first, when the agent has sales there but no listings there.
  let rotation: any = null
  if (config.blockVisibility?.banner) {
    const towns = (rotate?.towns || []).map(t => t.split(',')[0].trim().toLowerCase()).filter(Boolean)
    const inTown = (city?: string) => !!city && towns.includes(String(city).trim().toLowerCase())
    const toCard = (item: any) => ({
      image: item.image || '', kicker: 'FEATURED LISTING', address: (item.address || '').split(',')[0].trim(),
      location: [item.city, item.state].filter(Boolean).join(', '), price: fmtMoney(item.price), status: formatSaleStatus(item.status || 'Active'),
      beds: item.beds, baths: item.baths, sqft: item.sqft, acres: item.acres,
      // This slide opens THIS home (its Spotlight / property page, resolved by the backend per listing).
      href: item.listingLinkUrl || '',
    })
    const toSale = (x: any) => ({ image: x.image || '', city: x.city || '', price: fmtMoney(x.price) })
    const all = banner.showFeaturedListing !== false ? getEligibleListings(hubConfig.myListings || []).filter((l: any) => l.visible !== false) : []
    const byPrice = [...all].sort((a: any, b: any) => (b.price || 0) - (a.price || 0))
    const local = byPrice.filter((l: any) => inTown(l.city))
    const listings = [...local, ...byPrice.filter((l: any) => !inTown(l.city))].slice(0, 5)
    const pool = banner.showRecentSales !== false ? getSalesRotationPool(hubConfig.recentSales || [], hubConfig.salesMinPrice || 0) : []
    // The town's sales come from ALL the agent's shown sales (newest first), not only the newest
    // few in the pool - an older sale in the article's town still beats a recent one elsewhere.
    const townSales = banner.showRecentSales !== false && towns.length
      ? getSalesRotationPool(hubConfig.recentSales || [], hubConfig.salesMinPrice || 0, Infinity).filter((x: any) => inTown(x.city))
      : []
    let raw: any[] = []
    // The town's own sales lead; any open spots (of 3) fill with the agent's other recent sales.
    if (townSales.length) raw = [...townSales, ...pool.filter((x: any) => !inTown(x.city))].slice(0, 3)
    else if (all.length <= 3 && pool.length) raw = [...pool.slice(0, 6)].sort((a: any, b: any) => (b.price || 0) - (a.price || 0)).slice(0, 3)
    // Sales slide position: right after the town's own listings (first when there are none there).
    const salesAt = townSales.length ? local.length : listings.length
    // Fewer than 3 sales: each its own featured-style slide (a 3-slot row with gaps looked empty).
    const cards = listings.map(toCard)
    const sales = raw.length >= 3 ? raw.map(toSale) : null
    if (raw.length && raw.length < 3) cards.splice(Math.min(salesAt, cards.length), 0, ...raw.map(saleCard))
    if (cards.length + (sales ? 1 : 0) > 1) {
      rotation = { listings: cards, sales, salesAt, listingsHref: agentHubUrl ? `${agentHubUrl}/sales` : '', salesHref: agentHubUrl ? `${agentHubUrl}/sales` : '' }
    }
  }

  // Stats have their own switch - they show with the listings & sales card off too (as a strip).
  const stats = (() => {
    if (!banner.showStats) return null
    const summary = getSaleSummary(hubConfig.recentSales || [])
    return summary.totalSold ? { volume: fmtCompactMoney(summary.totalVolume), sold: String(summary.totalSold), avg: fmtCompactMoney(summary.avgPrice) } : null
  })()

  const luxe = !!config.luxe
  const metal = metalOf(config.luxeMetal)
  const statsStrip = !!stats && !listing && !saleCards && !rotation
  if (statsStrip && !salesHref && agentHubUrl) salesHref = `${agentHubUrl}/sales`
  return {
    identity, socials, buttons, listing, saleCards, listingHref, salesHref, stats, rotation, statsStrip,
    accent: luxe ? LUXE_METALS[metal].base : (config.accentColor || '#B87943'),
    fontFamily: signatureFontStack(luxe ? 'georgia' : (config.fontFamily || 'system')),
    dark: !!config.darkMode,
    luxe,
    metal,
  }
}
