import type { SiteBlock, SiteBlockType } from '@/types'
import {
  AlignLeft, BadgeCheck, CalendarDays, Clapperboard, ClipboardList, Heading, Home, Image as ImageIcon,
  LayoutGrid, Mail, MapPin, Minus, Newspaper, Quote, Sparkles, Star, UserRound, type LucideIcon,
} from 'lucide-react'

// The IDX editor's section catalogue: every section an agent can put on their home page, in
// plain words, with the data it's powered by and the settings it starts with. The Content tab
// lists what's on the page (reorder / show / hide / open to edit) and offers the rest from here -
// adding one inserts a complete, working section, not an empty shell. Rendering lives in
// components/website-public/blocks/*; hydration (the real listings/areas/reviews behind each
// section) in backend content_adapters.hydrate_page_blocks.

export type SectionGroup = 'homes' | 'you' | 'neighborhoods' | 'extras'

export const SECTION_GROUPS: { id: SectionGroup; label: string; blurb: string }[] = [
  { id: 'homes', label: 'Homes', blurb: 'Live from the MLS and your own listings.' },
  { id: 'you', label: 'You', blurb: 'Your profile, reviews and ways to reach you.' },
  { id: 'neighborhoods', label: 'Neighborhoods', blurb: 'The towns you serve, with real local data.' },
  { id: 'extras', label: 'Extras', blurb: 'Articles, text, photos and spacing.' },
]

export interface SectionDef {
  type: SiteBlockType
  label: string
  /** One sentence: what visitors see and where it comes from. */
  blurb: string
  icon: LucideIcon
  group: SectionGroup
  /** Only one of these makes sense per page - the catalogue hides it once it's on the page. */
  single?: boolean
  /** Can be switched off but never deleted (the page needs it). */
  core?: boolean
  /** Not offered in the catalogue (template-only). */
  addable?: boolean
  /** The data a freshly added section starts with - a complete section, not an empty one. */
  defaults: Record<string, any>
  /** What powers it, shown under the name ("Pulls from your MLS listings"). */
  powered?: string
  /** Where the underlying content is managed - a shortcut, not a second editor. `tab` switches
      this editor's own tab; `href` leaves for another part of OpenHousePal. */
  manage?: { label: string; href?: string; tab?: 'featured' | 'areas' | 'media' | 'reviews' }
}

export const SECTIONS: Record<SiteBlockType, SectionDef> = {
  hero: {
    type: 'hero', label: 'Welcome Screen', icon: Sparkles, group: 'you', single: true, core: true,
    blurb: 'Your opening screen: rotating MLS photos from your areas, your market line, a home search box and Buying / Selling / Home Value buttons.',
    powered: 'Photos and search come from the full MLS, buttons from your premade Forms.',
    defaults: { headline: 'Find Your Dream Home', subheadline: '', photo_source_mode: 'auto' },
  },
  featured_listings: {
    type: 'featured_listings', label: 'Featured Homes', icon: Star, group: 'homes', single: true,
    blurb: 'Big photo cards for the homes on your Featured tab - a gliding strip on Luxe, a clean grid on Classic.',
    powered: 'Pulls from your Featured tab (your listings, your areas, or a custom collection).',
    defaults: { headline: 'Featured Listings' },
    manage: { label: 'Choose which homes', tab: 'featured' },
  },
  newly_listed: {
    type: 'newly_listed', label: 'Just Listed', icon: Home, group: 'homes', single: true,
    blurb: 'Your newest listings the moment they hit the MLS - a rotating card stack on Luxe, a swipe row on Classic.',
    powered: 'Pulls from your own active MLS listings.',
    defaults: { headline: 'Newly Listed' },
  },
  spotlights: {
    type: 'spotlights', label: 'Listing Spotlights', icon: Clapperboard, group: 'homes', single: true,
    blurb: 'A card for every Spotlight page you have published - each opens that home\'s cinematic page.',
    powered: 'Pulls from Studio -> Spotlights (published only).',
    defaults: { headline: 'Listing Spotlights' },
    manage: { label: 'Manage Spotlights', href: '/studio/property-sites' },
  },
  open_houses: {
    type: 'open_houses', label: 'Open Houses', icon: CalendarDays, group: 'homes', single: true,
    blurb: 'Your upcoming open houses with dates and times - visitors tap one to see the home.',
    powered: 'Pulls from your Open Houses.',
    defaults: { headline: 'Upcoming Open Houses' },
    manage: { label: 'Manage Open Houses', href: '/open-houses' },
  },
  recent_sales: {
    type: 'recent_sales', label: 'Recently Sold', icon: BadgeCheck, group: 'homes', single: true,
    blurb: 'Your closed sales as proof of results - photo, address and sold price.',
    powered: 'Pulls from your closed MLS sales.',
    defaults: { headline: 'Recently Sold' },
  },
  showcase: {
    type: 'showcase', label: 'Showcase Collection', icon: LayoutGrid, group: 'homes', addable: false,
    blurb: 'A button to one of your Showcases - a hand-picked set of homes - with your own headline.',
    powered: 'Pulls from a Showcase you choose.',
    defaults: {},
    manage: { label: 'Manage Showcases', href: '/showcases' },
  },
  communities: {
    type: 'communities', label: 'Neighborhoods', icon: MapPin, group: 'neighborhoods', single: true,
    blurb: 'Photo tiles for every town on your Areas tab with live homes-for-sale counts and median prices - each opens its full neighborhood page.',
    powered: 'Pulls from your Areas tab and live MLS stats.',
    defaults: { headline: 'Neighborhoods We Serve' },
    manage: { label: 'Choose your areas', tab: 'areas' },
  },
  about_agent: {
    type: 'about_agent', label: 'About Me', icon: UserRound, group: 'you', single: true,
    blurb: 'Your photo, bio, track record and contact details. (Your email signature lives in the site footer - Design tab.)',
    powered: 'Pulls from your profile and Agent Hub.',
    defaults: {},
    manage: { label: 'Edit my profile', href: '/settings' },
  },
  testimonials: {
    type: 'testimonials', label: 'Client Reviews', icon: Quote, group: 'you', single: true,
    blurb: 'What your clients say - your published reviews, including any imported from Google.',
    powered: 'Shows while the Reviews tab has "Show reviews on my website" on, and you have reviews.',
    defaults: { headline: 'What Clients Say' },
    manage: { label: 'Manage reviews', tab: 'reviews' },
  },
  form: {
    type: 'form', label: 'Lead Form', icon: ClipboardList, group: 'you',
    blurb: 'One of your Forms, filled in right on the page - starts with your general "How Can I Help?" form. Every answer lands in your Leads.',
    powered: 'Pulls from Studio -> Forms (the general version, not a property campaign).',
    defaults: {},
    manage: { label: 'Manage Forms', href: '/studio/forms' },
  },
  contact_cta: {
    type: 'contact_cta', label: 'Contact Band', icon: Mail, group: 'you',
    blurb: 'A bold call / text / email band - the natural close of the page.',
    powered: 'Uses the phone and email from your profile unless you type different ones.',
    defaults: { headline: "Let's Find Your Perfect Home" },
  },
  blog_posts: {
    type: 'blog_posts', label: 'Latest Articles', icon: Newspaper, group: 'extras', single: true,
    blurb: 'Your newest published blog posts, with a link to the full Blog page.',
    powered: 'Pulls from Studio -> Blogs (published only).',
    defaults: { headline: 'Latest Articles', limit: 3 },
    manage: { label: 'Manage Blog', href: '/studio/blogs' },
  },
  rich_text: {
    type: 'rich_text', label: 'Text', icon: AlignLeft, group: 'extras',
    blurb: 'A paragraph or two in your own words.',
    defaults: { text: '' },
  },
  image: {
    type: 'image', label: 'Photo', icon: ImageIcon, group: 'extras',
    blurb: 'One photo of your choice, with an optional caption.',
    defaults: {},
  },
  divider: {
    type: 'divider', label: 'Divider', icon: Minus, group: 'extras',
    blurb: 'A thin line to separate two sections.',
    defaults: {},
  },
  heading_text: {
    type: 'heading_text', label: 'Heading', icon: Heading, group: 'extras', addable: false,
    blurb: 'A page title (used on the About, Sold and Contact pages).',
    defaults: { text: '', level: 'h2' },
  },
}

/** Catalogue order - homes first, then you, neighborhoods, extras. */
export const SECTION_ORDER: SiteBlockType[] = [
  'featured_listings', 'newly_listed', 'spotlights', 'open_houses', 'recent_sales', 'showcase',
  'hero', 'about_agent', 'testimonials', 'form', 'contact_cta',
  'communities',
  'blog_posts', 'rich_text', 'image', 'divider', 'heading_text',
]

export function sectionDef(type: SiteBlockType): SectionDef {
  return SECTIONS[type] || SECTIONS.rich_text
}

/** A fresh, fully configured block of this type (defaults + anything the caller resolved). */
export function newSectionBlock(type: SiteBlockType, extra: Record<string, any> = {}): SiteBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    hidden: false,
    data: { ...sectionDef(type).defaults, ...extra },
  }
}
