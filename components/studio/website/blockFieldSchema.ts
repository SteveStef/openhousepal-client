import { SiteBlockType } from '@/types'
import { SECTIONS } from './sectionCatalogue'

export interface BlockField {
  key: string
  label: string
  /** A short plain-words note under the field. */
  hint?: string
  kind: 'text' | 'textarea' | 'url' | 'select' | 'form_picker' | 'showcase_picker' | 'checkbox' | 'image' | 'number'
  options?: { value: string; label: string }[]
  placeholder?: string
  defaultChecked?: boolean
  /** Only show this field when the section's data says so (e.g. the upload box only in manual photo mode). */
  showWhen?: (data: Record<string, any>) => boolean
}

// Friendly names for every section type (the catalogue is the source of truth).
export const BLOCK_TYPE_LABELS: Record<SiteBlockType, string> = Object.fromEntries(
  (Object.keys(SECTIONS) as SiteBlockType[]).map(type => [type, SECTIONS[type].label]),
) as Record<SiteBlockType, string>

// Every data-backed section lets the agent pick how many items show; which items show is always
// automatic (the hidden `source_mode` from the data model is left untouched - no UI for it).
// The placeholder is what a blank box really gives (backend content_adapters._DEFAULT_LIMITS), and
// `max` is the most the section can lay out - higher numbers used to do nothing (10/27 audit).
const LIMIT_FIELD = (what: string, placeholder = '6', max?: number): BlockField => ({
  key: 'limit', label: `How many ${what} to show`, kind: 'number', placeholder,
  hint: `Leave blank for ${placeholder}.${max ? ` Up to ${max}.` : ''}`,
})

export const BLOCK_FIELD_SCHEMA: Record<SiteBlockType, BlockField[]> = {
  hero: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Find Your Dream Home', hint: 'The last two words get your accent color.' },
    // The eyebrow is filled automatically with the agent's own market line (see
    // content_adapters.hydrate_page_blocks) - this only overrides it.
    { key: 'eyebrow', label: 'Small line above the headline', kind: 'text', placeholder: 'Filled in from your market line', hint: 'Leave blank to use the market line from your profile.' },
    { key: 'subheadline', label: 'Team or brand name (optional)', kind: 'text', placeholder: 'The Stefanatos Group' },
    // 'auto' searches the full regional MLS across the agent's served areas and rotates up to 5
    // real photos (content_adapters.get_hero_photos); 'manual' uses one uploaded photo.
    { key: 'photo_source_mode', label: 'Background photos', kind: 'select', options: [
      { value: 'auto', label: 'The newest homes in my towns (set them on the Featured tab)' },
      { value: 'manual', label: 'Use one photo I upload' },
    ] },
    { key: 'image_url', label: 'Your photo', kind: 'image', showWhen: d => d.photo_source_mode === 'manual' },
    { key: 'show_search', label: 'Show the home search box', kind: 'checkbox', defaultChecked: true },
    { key: 'show_quick_actions', label: 'Show the Buying / Selling / Home Value buttons', kind: 'checkbox', defaultChecked: true, hint: 'They open your premade forms.' },
  ],
  heading_text: [
    { key: 'text', label: 'Heading', kind: 'text' },
    { key: 'level', label: 'Size', kind: 'select', options: [{ value: 'h1', label: 'Large' }, { value: 'h2', label: 'Medium' }, { value: 'h3', label: 'Small' }] },
  ],
  rich_text: [
    { key: 'text', label: 'Your text', kind: 'textarea' },
  ],
  image: [
    { key: 'url', label: 'Photo', kind: 'image' },
    { key: 'caption', label: 'Caption (optional)', kind: 'text' },
    { key: 'alt', label: 'Describe the photo (for accessibility)', kind: 'text' },
  ],
  about_agent: [
    // Real profile data comes in automatically (content_adapters.get_agent_profile). These are
    // optional website-only overrides layered on top.
    { key: 'overrides.bio', label: 'A different bio just for the website (optional)', kind: 'textarea', placeholder: 'Leave blank to use your profile bio' },
    { key: 'overrides.photo_url', label: 'A different photo (optional)', kind: 'image' },
    { key: 'overrides.phone', label: 'Different phone (optional)', kind: 'text' },
    { key: 'overrides.email', label: 'Different email (optional)', kind: 'text' },
  ],
  contact_cta: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: "Let's Talk" },
    { key: 'subtext', label: 'A line underneath (optional)', kind: 'textarea' },
    { key: 'phone', label: 'Phone', kind: 'text', hint: 'Blank = the phone on your profile.' },
    { key: 'email', label: 'Email', kind: 'text', hint: 'Blank = the email on your profile.' },
  ],
  divider: [],
  featured_listings: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Featured Listings' },
    { key: 'eyebrow', label: 'Small line above it', kind: 'text', placeholder: 'Featured' },
    { key: 'subtext', label: 'A line underneath (optional)', kind: 'textarea', placeholder: 'A curated selection of exceptional homes available now.' },
    // Which homes show always follows the Featured tab (one source of truth); this only sets how many.
    LIMIT_FIELD('homes', '6', 9),
  ],
  recent_sales: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Recently Sold' },
    LIMIT_FIELD('sales'),
  ],
  open_houses: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Upcoming Open Houses' },
    LIMIT_FIELD('open houses', '4'),
  ],
  blog_posts: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Latest Articles' },
    LIMIT_FIELD('articles', '3', 4),
  ],
  form: [
    { key: 'form_id', label: 'Which form', kind: 'form_picker', hint: 'The general version of the form - answers go to your Leads.' },
  ],
  showcase: [
    { key: 'collection_id', label: 'Which showcase', kind: 'showcase_picker' },
    { key: 'headline', label: 'Headline (optional)', kind: 'text' },
    { key: 'subtext', label: 'A line underneath (optional)', kind: 'textarea' },
  ],
  communities: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Explore Neighborhoods' },
    { key: 'eyebrow', label: 'Small line above it', kind: 'text', placeholder: 'Neighborhoods We Serve' },
    { key: 'subtext', label: 'A line underneath (optional)', kind: 'textarea', placeholder: 'Live inventory, price ranges, schools and local context at a glance.' },
    LIMIT_FIELD('neighborhoods', '6'),
  ],
  newly_listed: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Newly Listed' },
    { key: 'eyebrow', label: 'Small line above it', kind: 'text', placeholder: 'Just Listed' },
    { key: 'subtext', label: 'A line underneath (optional)', kind: 'textarea', placeholder: 'The latest exceptional properties to hit the market.' },
    LIMIT_FIELD('homes', '8'),
  ],
  // Published OpenHousePal reviews (client-submitted + imported from Google), newest first.
  testimonials: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'What Clients Say' },
  ],
  // The agent's published Listing Spotlights (Studio -> Spotlights) as cards.
  spotlights: [
    { key: 'headline', label: 'Headline', kind: 'text', placeholder: 'Listing Spotlights' },
    { key: 'eyebrow', label: 'Small line above it', kind: 'text', placeholder: 'Spotlights' },
    { key: 'subtext', label: 'A line underneath (optional)', kind: 'textarea' },
    LIMIT_FIELD('spotlights'),
  ],
}
