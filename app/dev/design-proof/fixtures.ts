import type { BrandKit, LinkedProperty } from '@/types'
import type { DesignAgentInfo } from '@/lib/studio/designAgent'
import { PLACEHOLDER_PROPERTY } from '@/lib/studio/designFormats'
import type { TemplateBuildOptions } from '@/lib/studio/designTemplates'
import type { DesignMessagingVariant } from '@/lib/studio/designSituations'

// Dev-only stress content for /dev/design-proof: every template is judged against real-world
// content, not just the one perfect sample listing it was art-directed around.

const unsplash = (id: string, extra = '') => `https://images.unsplash.com/${id}?w=1400&q=80${extra}`

const AGENT_BASE: DesignAgentInfo = {
  agentName: 'Peter Stefanatos',
  agentTitle: 'Real Estate Agent',
  agentBrokerage: 'Compass RE',
  agentPhotoUrl: 'https://dk5bvrzdygq8w.cloudfront.net/agent-photos/8d192d09-f7d2-4cdb-8bbc-5820d39b4d22.jpg',
  agentPhotoPosition: null,
  agentPhone: '610-781-7003',
  agentOfficePhone: '610-520-0100',
  agentEmail: 'peter.stefanatos@compass.com',
  agentHubSlug: 'peter-stefanatos',
}

const BRAND_BASE: BrandKit = {
  primary_color: '#111827', secondary_color: '#C9A24D', accent_color: '#816937', heading_font: 'serif', body_font: 'sans',
  personal_logo_url: null, team_logo_url: null, brokerage_logo_url: null, disclaimer_text: null,
}

const LONG_DESCRIPTION = 'Set behind a canopy of century-old oaks on nearly two manicured acres, this meticulously renovated Main Line estate pairs classic stone architecture with a thoroughly modern interior. The chef\'s kitchen opens to a sun-washed family room and a bluestone terrace overlooking the pool and gardens; a first-floor primary suite, a paneled library, a climate-controlled wine room and a finished lower level with a gym and media room complete the picture. Minutes to the train, the Radnor Trail and the area\'s best schools.'

export interface ProofVariant {
  id: string
  label: string
  property: LinkedProperty | null
  agent: DesignAgentInfo
  brandKit: BrandKit
  options: TemplateBuildOptions
  messaging?: DesignMessagingVariant
  /** Social posts: the Instagram button the agent picked. */
  socialButton?: string
  /** Lead-gen situations only: override the hero photo ('' = no photo). */
  leadPhoto?: string | null
}

const base: LinkedProperty = { ...PLACEHOLDER_PROPERTY, description: 'A meticulously renovated estate blending classic architecture with modern luxury, set on over an acre of manicured grounds.' }
const OH_OPTIONS: TemplateBuildOptions = { openHouseDate: 'Sunday, October 12', openHouseTime: '1:00 – 3:00 PM' }

export const VARIANTS: Record<string, ProofVariant> = {
  base: { id: 'base', label: 'Sample listing', property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS } },
  button: { id: 'button', label: 'Instagram button', property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS }, socialButton: 'Contact Us' },
  // open-house time ranges that run long (user 10/09: "3:30-5:30 is long")
  halfhour: { id: 'halfhour', label: '3:30-5:30 PM', property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, openHouseDate: 'Saturday, September 27', openHouseTime: '3:30 – 5:30 PM' } },
  // two days, each with its own (long) hours (user 10/10)
  twotimes: { id: 'twotimes', label: '2 days, 2 times', property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, openHouseDate: 'Saturday, November 22 & Sunday, November 23', openHouseTime: '10:30 AM – 12:30 PM & 1:00 – 3:00 PM' } },
  twotimes2: { id: 'twotimes2', label: '2 days, 2 long times, 2 months', property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, openHouseDate: 'Sunday, November 30 & Monday, December 1', openHouseTime: '11:30 AM – 1:30 PM & 3:30 – 5:30 PM' } },
  ampm: { id: 'ampm', label: '10:30 AM-12:30 PM', property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, openHouseDate: 'Wednesday, December 31', openHouseTime: '10:30 AM – 12:30 PM' } },
  long: {
    id: 'long', label: 'Long everything',
    property: {
      ...base, address: '12345 West Montgomery Avenue Northwest, Unit 1204', city: 'Bala Cynwyd', state: 'PA', zipcode: '19004',
      price: 1249000, close_price: 1215000, original_price: 1349000, beds: 4, baths: 3.5, sqft: 4350, lot_size: 32670, description: LONG_DESCRIPTION,
    },
    agent: { ...AGENT_BASE, agentName: 'Alexandria Montgomery-Whitaker', agentTitle: 'Associate Broker, Luxury Collection', agentBrokerage: 'Berkshire Hathaway HomeServices Fox & Roach', agentEmail: 'alexandria.montgomery-whitaker@bhhsfoxroach.com', agentPhone: '(610) 555-0147' },
    brandKit: BRAND_BASE,
    options: { openHouseDate: 'Saturday, November 22 & Sunday, November 23', openHouseTime: '12:00 – 4:00 PM', previousPrice: '1349000' },
    messaging: { id: 'custom', headline: 'Thinking about selling your home this spring season?' },
  },
  short: {
    id: 'short', label: 'Short everything',
    property: { ...base, address: '9 Elm St', city: 'Wayne', state: 'PA', zipcode: '19087', price: 325000, close_price: 331000, beds: 2, baths: 1, sqft: 980, lot_size: 4000, description: 'Charming starter home near the train.', photos: base.photos },
    agent: { ...AGENT_BASE, agentName: 'Al Li', agentTitle: 'Realtor', agentBrokerage: 'Keller', agentEmail: 'al@kw.com', agentPhone: '2155550100' },
    brandKit: BRAND_BASE,
    options: { ...OH_OPTIONS, openHouseDate: 'Sun, Oct 12', openHouseTime: '1–3 PM' },
    messaging: { id: 'custom', headline: 'Sell?' },
  },
  big: {
    id: 'big', label: 'Big numbers',
    property: { ...base, address: '1 Grays Lane', city: 'Haverford', state: 'PA', zipcode: '19041', price: 12500000, close_price: 12100000, original_price: 13950000, beds: 7, baths: 9.5, sqft: 14250, lot_size: 217800, year_built: 1911 },
    agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, previousPrice: '13950000' },
  },
  noprice: {
    id: 'noprice', label: 'No price, few facts',
    property: { ...base, price: null, close_price: null, beds: null, baths: null, sqft: null, lot_size: null, description: null },
    agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, priceMode: 'hidden' },
  },
  nophoto: {
    id: 'nophoto', label: 'No photo at all',
    property: { ...base, image_url: null, photos: [] },
    agent: { ...AGENT_BASE, agentPhotoUrl: null }, brandKit: BRAND_BASE, options: { ...OH_OPTIONS }, leadPhoto: '',
  },
  dark: {
    id: 'dark', label: 'Dark photo',
    property: { ...base, image_url: unsplash('photo-1600596542815-ffad4c1539a9'), photos: [unsplash('photo-1600596542815-ffad4c1539a9'), unsplash('photo-1600585154340-be6161a56a0c'), unsplash('photo-1600607687939-ce8a6c25118c')] },
    agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS }, leadPhoto: unsplash('photo-1600596542815-ffad4c1539a9'),
  },
  light: {
    id: 'light', label: 'Bright white photo',
    property: { ...base, image_url: unsplash('photo-1600566753086-00f18fb6b3ea'), photos: [unsplash('photo-1600566753086-00f18fb6b3ea'), unsplash('photo-1600210492486-724fe5c67fb0'), unsplash('photo-1600585154340-be6161a56a0c')] },
    agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS }, leadPhoto: unsplash('photo-1600566753086-00f18fb6b3ea'),
  },
  portrait: {
    id: 'portrait', label: 'Portrait photo',
    property: { ...base, image_url: unsplash('photo-1613977257363-707ba9348227', '&h=1800&fit=crop'), photos: [unsplash('photo-1613977257363-707ba9348227', '&h=1800&fit=crop'), unsplash('photo-1600585154340-be6161a56a0c', '&h=1800&fit=crop')] },
    agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS }, leadPhoto: unsplash('photo-1613977257363-707ba9348227', '&h=1800&fit=crop'),
  },
  logo: {
    id: 'logo', label: 'Wide logo + long brokerage',
    property: base,
    agent: { ...AGENT_BASE, agentBrokerage: 'Berkshire Hathaway HomeServices Fox & Roach' },
    brandKit: { ...BRAND_BASE, personal_logo_url: 'http://localhost:3000/dev-proof/logo-wide.svg' }, options: { ...OH_OPTIONS },
  },
  talllogo: {
    id: 'talllogo', label: 'Tall logo, no headshot',
    property: base,
    agent: { ...AGENT_BASE, agentPhotoUrl: null },
    brandKit: { ...BRAND_BASE, personal_logo_url: 'http://localhost:3000/dev-proof/logo-tall.svg' }, options: { ...OH_OPTIONS },
  },
  bare: {
    id: 'bare', label: 'Minimal agent info',
    property: base,
    agent: { ...AGENT_BASE, agentTitle: null, agentBrokerage: null, agentPhotoUrl: null, agentEmail: null, agentPhone: null },
    brandKit: BRAND_BASE, options: { ...OH_OPTIONS },
  },
  brand: {
    id: 'brand', label: 'Brand kit colors (navy/teal)',
    property: base, agent: AGENT_BASE,
    brandKit: { ...BRAND_BASE, primary_color: '#0B2545', secondary_color: '#13A89E', personal_logo_url: 'http://localhost:3000/dev-proof/logo-wide.svg' },
    options: { ...OH_OPTIONS },
  },
  hidestreet: {
    id: 'hidestreet', label: 'Street hidden',
    property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, hideStreet: true },
  },
  manual: {
    id: 'manual', label: 'Typed price + no QR',
    property: base, agent: AGENT_BASE, brandKit: BRAND_BASE, options: { ...OH_OPTIONS, priceMode: 'manual', manualPrice: '2999999', qrHidden: true },
  },
}

export const VARIANT_IDS = Object.keys(VARIANTS)
