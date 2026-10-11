import { BlogBlock } from '@/types'

export interface BlogTopicTemplate {
  id: string
  title: string
  category: string
  description: string
}

export const BLOG_TOPICS: BlogTopicTemplate[] = [
  { id: 'buyer_market_approach', title: 'How to Approach the Housing Market as a Buyer', category: 'Buyers', description: 'Orient a new buyer to the current market and what to expect.' },
  { id: 'first_time_buyer_guide', title: 'First-Time Homebuyer Guide', category: 'Buyers', description: 'A friendly walkthrough of the buying process from search to closing.' },
  { id: 'prepare_home_for_sale', title: 'How to Prepare a Home for Sale', category: 'Sellers', description: 'Practical steps to get a listing market-ready.' },
  { id: 'competitive_offer', title: 'Preparing a Competitive Offer', category: 'Buyers', description: 'What makes an offer stand out in a competitive market.' },
  { id: 'closing_costs', title: 'Understanding Closing Costs', category: 'Buyers', description: 'Break down what buyers actually pay at closing.' },
  { id: 'monthly_market_update', title: 'Monthly Market Update', category: 'Market Updates', description: 'A recurring look at local pricing, inventory, and demand trends.' },
  { id: 'neighborhood_spotlight', title: 'Neighborhood Spotlight', category: 'Neighborhoods', description: 'Feature a specific neighborhood, its character, and its market.' },
  { id: 'school_district_guide', title: 'School District Guide', category: 'Neighborhoods', description: 'Help families understand the local school landscape.' },
  { id: 'home_maintenance_checklist', title: 'Seasonal Home Maintenance Checklist', category: 'Homeownership', description: 'A practical checklist homeowners can act on right away.' },
  { id: 'just_sold_story', title: 'Just Sold Story', category: 'Market Updates', description: 'Turn a recent closing into a story that builds trust.' },
  { id: 'open_house_recap', title: 'Open House Recap', category: 'Market Updates', description: 'Recap turnout, interest, and next steps from a recent open house.' },
  { id: 'investment_property_guide', title: 'Investment Property Guide', category: 'Investments', description: 'Introduce buyers to the basics of investing in real estate.' },
  { id: 'downsizing_guide', title: 'Downsizing Guide', category: 'Homeownership', description: 'Help empty-nesters or retirees think through downsizing.' },
  { id: 'new_construction_guide', title: 'New Construction Guide', category: 'New Construction', description: 'Explain what makes buying new construction different.' },
  { id: 'buyer_faq', title: 'Frequently Asked Buyer Questions', category: 'Buyers', description: 'Answer the questions buyers ask most.' },
  { id: 'seller_faq', title: 'Frequently Asked Seller Questions', category: 'Sellers', description: 'Answer the questions sellers ask most.' },
]

export const BLOG_CATEGORIES = [
  'Buyers', 'Sellers', 'Market Updates', 'Neighborhoods', 'Homeownership',
  'Luxury', 'Investments', 'Open Houses', 'Local Guides', 'New Construction', 'Real Estate News',
]

let counter = 0
function blockId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export function buildStarterBlocks(topic: BlogTopicTemplate | null): BlogBlock[] {
  if (!topic) {
    return [
      { id: blockId('heading'), type: 'heading', data: { text: 'Untitled Article' } },
      { id: blockId('paragraph'), type: 'paragraph', data: { text: '' } },
    ]
  }
  return [
    { id: blockId('paragraph'), type: 'paragraph', data: { text: topic.description } },
    { id: blockId('heading'), type: 'heading', data: { text: 'Getting Started' } },
    { id: blockId('paragraph'), type: 'paragraph', data: { text: '' } },
    { id: blockId('heading'), type: 'heading', data: { text: 'What This Means for You' } },
    { id: blockId('paragraph'), type: 'paragraph', data: { text: '' } },
    { id: blockId('cta'), type: 'cta', data: { label: 'Ask Me a Question', action: 'contact', formType: 'question' } },
  ]
}

// What an article's closing section (the Call to Action block) can open: the agent's premade forms,
// or the in-article question box. Same keys as the AI writer's brief (backend _CTA_FORMS) and the
// Email Signature's form buttons.
export const BLOG_CTA_FORMS: { formType: string; label: string; short: string }[] = [
  { formType: 'how_can_i_help', label: 'Ready to Buy or Sell?', short: 'Buy or sell' },
  { formType: 'home_value', label: "What's My Home Worth?", short: 'Home value' },
  { formType: 'showing', label: 'Schedule a Showing', short: 'Showing' },
  { formType: 'buying', label: "I'm Buying", short: 'Buying' },
  { formType: 'selling', label: "I'm Selling", short: 'Selling' },
  { formType: 'make_me_sell', label: 'Make Me Sell', short: 'Make me sell' },
  { formType: 'question', label: 'Ask Me a Question', short: 'Question' },
]

/** The form a Call to Action block opens - its saved choice, else read from older articles' button
 *  wording ("Book a Consultation" -> Ready to Buy or Sell?). */
export function ctaFormTypeOf(data: { formType?: string; label?: string } | undefined): string {
  if (data?.formType && BLOG_CTA_FORMS.some(f => f.formType === data.formType)) return data.formType
  const l = String(data?.label || '').toLowerCase()
  if (/worth|value|apprais/.test(l)) return 'home_value'
  if (/tour|showing|see (a|the) home|visit/.test(l)) return 'showing'
  if (/make me sell/.test(l)) return 'make_me_sell'
  if (/\bsell/.test(l) && !/buy/.test(l)) return 'selling'
  if (/\bbuy/.test(l) && !/sell/.test(l)) return 'buying'
  if (/question|ask|anything/.test(l)) return 'question'
  return 'how_can_i_help'
}

// Per-block layout (align/size), stored on block.data and shared between the blog editor's
// toolbar and the read-only renderers (in-editor preview, public article page) so published
// articles look exactly like what was styled in the editor. Bold/italic/underline/strikethrough/
// links are inline marks within the block's rich text (data.html) instead of whole-block
// toggles - see RichTextBlock/FloatingTextToolbar in the blog editor.
export interface TextBlockStyle {
  align?: 'left' | 'center'
  size?: 'sm' | 'base' | 'lg'
}

export function textStyleClasses(data: TextBlockStyle | undefined, { allowSize = false }: { allowSize?: boolean } = {}): string {
  const parts: string[] = []
  if (data?.align === 'center') parts.push('text-center')
  if (allowSize) parts.push(data?.size === 'sm' ? 'text-sm' : data?.size === 'lg' ? 'text-lg' : 'text-base')
  return parts.join(' ')
}

export const ADDABLE_BLOG_BLOCK_TYPES: { type: BlogBlock['type']; label: string; group: string }[] = [
  { type: 'heading', label: 'Heading', group: 'Text' },
  { type: 'subheading', label: 'Subheading', group: 'Text' },
  { type: 'paragraph', label: 'Paragraph', group: 'Text' },
  { type: 'quote', label: 'Quote', group: 'Text' },
  { type: 'bulleted_list', label: 'Bulleted List', group: 'Text' },
  { type: 'numbered_list', label: 'Numbered List', group: 'Text' },
  { type: 'callout', label: 'Callout Box', group: 'Text' },
  { type: 'divider', label: 'Divider', group: 'Text' },
  { type: 'image', label: 'Image', group: 'Media' },
  { type: 'gallery', label: 'Image Gallery', group: 'Media' },
  { type: 'youtube', label: 'YouTube Video', group: 'Media' },
  { type: 'property_card', label: 'Property Card', group: 'Real Estate' },
  { type: 'area_spotlight', label: 'Town Spotlight', group: 'Real Estate' },
  { type: 'agent_profile', label: 'Agent Profile', group: 'Real Estate' },
  { type: 'qr_code', label: 'QR Code', group: 'Real Estate' },
  { type: 'button', label: 'Button', group: 'Action' },
  { type: 'cta', label: 'Call to Action', group: 'Action' },
  { type: 'contact_form', label: 'Contact Form', group: 'Action' },
  { type: 'lead_form', label: 'Lead Form (one of your forms)', group: 'Action' },
  { type: 'related_articles', label: 'Related Articles', group: 'Action' },
  { type: 'disclaimer', label: 'Disclaimer', group: 'Action' },
]
