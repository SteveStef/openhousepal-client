export type DesignSituationId =
  | 'just_listed' | 'coming_soon' | 'open_house' | 'price_improvement' | 'under_contract' | 'just_sold'
  | 'home_valuation' | 'make_me_sell' | 'find_your_dream_home' | 'social_ad'

export interface DesignMessagingVariant {
  id: string
  headline: string
  subtext?: string
}

// Starter copy for the no-property (lead-gen) situations. Deliberately makes no promises about
// price, speed or outcome - compliance-safe for farming mailers and social ads.
export interface DesignLeadGenCopy {
  eyebrow: string
  subtext: string
  cta: string
  qrLabel: string
  formType: string // the agent's own form (AgentFormConfig.form_type) the QR should open, if they have one
}

const photo = (id: string) => `https://images.unsplash.com/${id}?w=1600&q=80`

// Extra exteriors every no-listing design can pick from, after its own 4 (all checked by eye - real
// houses, front/side views, no interiors). An agent can also use a photo of a home they listed or sold.
const MORE_HOMES = [
  'photo-1598228723793-52759bba239c', 'photo-1572120360610-d971b9d7767c', 'photo-1576941089067-2de3c901e126',
  'photo-1592595896551-12b371d546d5', 'photo-1605146769289-440113cc3d00', 'photo-1564013799919-ab600027ffc6',
  'photo-1600585154340-be6161a56a0c', 'photo-1613490493576-7fde63acd811', 'photo-1494526585095-c41746248156',
  'photo-1600047509807-ba8f99d2cdde', 'photo-1580587771525-78b9dba3b914', 'photo-1600596542815-ffad4c1539a9',
  'photo-1568605114967-8130f3a36994', 'photo-1558036117-15d82a90b9b1', 'photo-1599809275671-b5942cabc7a2',
  'photo-1597211833712-5e41faa202ea',
].map(photo)
const withMore = (own: string[]) => Array.from(new Set([...own, ...MORE_HOMES]))

export interface DesignSituationDef {
  id: DesignSituationId
  label: string
  description: string
  // False only for the 3 lead-gen situations below - those have no property to attach and use
  // messagingVariants instead (see DesignCreateFlow's Property/Message step).
  propertyAttached: boolean
  formats: string[] // curated designType subset, references DESIGN_FORMATS by id
  messagingVariants?: DesignMessagingVariant[]
  leadGenCopy?: DesignLeadGenCopy
  // Lead-gen only: curated lifestyle photography for a design with no listing attached. Always
  // swappable for the agent's own upload (wizard + editor Photos tab).
  photoLibrary?: string[]
}

// What am I creating marketing for? - the first choice in the wizard, before Format. Curated
// per-situation format lists are a product judgment call, not derived from anything - review
// before shipping. Formats whose name already bakes in a situation (just_listed_flyer,
// open_house_flyer, just_sold_post) are scoped to only that one situation on purpose.
export const DESIGN_SITUATIONS: DesignSituationDef[] = [
  {
    id: 'just_listed',
    label: 'Just Listed',
    description: 'Announce a newly listed property.',
    propertyAttached: true,
    formats: ['just_listed_flyer', 'postcard', 'postcard_jumbo', 'instagram_post', 'instagram_portrait', 'instagram_story'],
  },
  {
    id: 'coming_soon',
    label: 'Coming Soon',
    description: 'Promote a property before it goes fully active.',
    propertyAttached: true,
    formats: ['postcard', 'postcard_jumbo', 'letter_mailer', 'instagram_post', 'instagram_portrait', 'instagram_story'],
  },
  {
    id: 'open_house',
    label: 'Open House',
    description: 'Invite buyers and neighbors to an open house.',
    propertyAttached: true,
    formats: ['open_house_flyer', 'postcard', 'postcard_jumbo', 'door_hanger', 'instagram_post', 'instagram_portrait', 'instagram_story'],
  },
  {
    id: 'price_improvement',
    label: 'Price Improvement',
    description: 'Announce a price reduction or new asking price.',
    propertyAttached: true,
    formats: ['postcard', 'postcard_jumbo', 'letter_mailer', 'instagram_post', 'instagram_portrait', 'instagram_story'],
  },
  {
    id: 'under_contract',
    label: 'Under Contract',
    description: 'Announce that a property is under contract.',
    propertyAttached: true,
    formats: ['postcard', 'postcard_jumbo', 'instagram_post', 'instagram_portrait', 'instagram_story'],
  },
  {
    id: 'just_sold',
    label: 'Just Sold',
    description: 'Celebrate a closed sale - for social announcements and neighborhood marketing.',
    propertyAttached: true,
    formats: ['postcard', 'postcard_jumbo', 'letter_mailer', 'door_hanger', 'instagram_post', 'instagram_portrait', 'instagram_story'],
  },
  {
    id: 'home_valuation',
    label: 'Home Valuation',
    description: 'Get homeowners curious about what their property is worth.',
    propertyAttached: false,
    formats: ['postcard', 'postcard_jumbo', 'letter_mailer', 'door_hanger', 'instagram_post', 'instagram_portrait'],
    messagingVariants: [
      { id: 'what_is_it_worth', headline: 'What is your home worth today?' },
      { id: 'curious', headline: "Curious about your home's value?" },
      { id: 'see_what_it_could_sell_for', headline: 'See what your home could sell for.' },
    ],
    leadGenCopy: {
      eyebrow: 'Free Home Valuation',
      subtext: "A personal, no-obligation look at your home's value. Based on real recent sales near you. Prepared by me personally, completely free.",
      cta: "Your home's value in today's market",
      qrLabel: 'Scan to find out',
      formType: 'home_value',
    },
    photoLibrary: withMore([photo('photo-1570129477492-45c003edd2be'), photo('photo-1583608205776-bfd35f0d9f83'), photo('photo-1605276374104-dee2a0ed3cd6'), photo('photo-1560518883-ce09059eeffa')]),
  },
  {
    id: 'make_me_sell',
    label: 'Make Me Sell',
    description: 'Reach homeowners who would sell at the right price.',
    propertyAttached: false,
    formats: ['postcard', 'postcard_jumbo', 'letter_mailer', 'door_hanger', 'instagram_post', 'instagram_portrait'],
    messagingVariants: [
      { id: 'what_price', headline: 'What price would make you move?' },
      { id: 'right_price', headline: 'Would you sell if the price were right?' },
      { id: 'thinking_about_selling', headline: 'Thinking about selling?' },
    ],
    leadGenCopy: {
      eyebrow: 'For Homeowners',
      subtext: "Tell me the number that would make a move worth it. I'll show you what today's market can do. Private, just between us.",
      cta: 'Share your number',
      qrLabel: 'Scan & name your price',
      formType: 'make_me_sell',
    },
    photoLibrary: withMore([photo('photo-1568605114967-8130f3a36994'), photo('photo-1558036117-15d82a90b9b1'), photo('photo-1570129477492-45c003edd2be'), photo('photo-1605276374104-dee2a0ed3cd6')]),
  },
  {
    id: 'find_your_dream_home',
    label: 'Find Your Dream Home',
    description: 'Attract buyers who are starting their home search.',
    propertyAttached: false,
    formats: ['postcard', 'postcard_jumbo', 'instagram_post', 'instagram_portrait', 'instagram_story'],
    messagingVariants: [
      { id: 'find_your_dream_home', headline: 'Find your dream home.' },
      { id: 'lets_find_your_next_home', headline: "Let's find your next home." },
      { id: 'start_your_search', headline: 'Start your home search.' },
    ],
    leadGenCopy: {
      eyebrow: 'For Buyers',
      subtext: "Early access to new listings, honest advice on every home you tour, and I'll be right there with you from the first showing to closing day.",
      cta: 'Start your search here',
      qrLabel: 'Scan to start your search',
      formType: 'buying',
    },
    photoLibrary: withMore([photo('photo-1502672260266-1c1ef2d93688'), photo('photo-1580587771525-78b9dba3b914'), photo('photo-1560518883-ce09059eeffa'), photo('photo-1568605114967-8130f3a36994')]),
  },
  {
    id: 'social_ad',
    label: 'Social Media Ad',
    description: 'A paid Instagram or Facebook ad that brings in buyer and seller leads.',
    propertyAttached: false,
    // The sizes Meta actually serves: 4:5 feed, 1:1 feed, 9:16 Stories/Reels.
    formats: ['instagram_portrait', 'instagram_post', 'instagram_story'],
    messagingVariants: [
      { id: 'selling_this_year', headline: 'Thinking about selling this year?' },
      { id: 'home_worth', headline: 'Find out what your home is really worth.' },
      { id: 'new_listings_first', headline: 'See new listings before anyone else.' },
      { id: 'next_home', headline: 'Ready to find your next home?' },
    ],
    leadGenCopy: {
      eyebrow: 'Your Local Expert',
      subtext: "Straight answers and a plan I'll build around you - whether you're buying, selling, or just curious about the market.",
      cta: "Let's talk about your next move",
      qrLabel: 'Scan to get started',
      formType: 'how_can_i_help',
    },
    photoLibrary: withMore([photo('photo-1600596542815-ffad4c1539a9'), photo('photo-1570129477492-45c003edd2be'), photo('photo-1605276374104-dee2a0ed3cd6'), photo('photo-1560518883-ce09059eeffa')]),
  },
]

export function getSituation(situationId: string): DesignSituationDef | undefined {
  return DESIGN_SITUATIONS.find(s => s.id === situationId)
}

// The first situation (in declared order) that lists this format - used wherever a format needs
// one representative situation to pre-seed into (e.g. the dashboard's browse carousel), since a
// format can appear under several situations' curated lists.
export function getPrimarySituationForFormat(designType: string): DesignSituationId | undefined {
  return DESIGN_SITUATIONS.find(s => s.formats.includes(designType))?.id
}
