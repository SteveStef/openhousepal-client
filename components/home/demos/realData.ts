// Real data pulled live from the user's own dev account (peter-stefanatos) via the app's public
// APIs and a direct read of the local dev database - the user asked that this whole section of
// the homepage illustrate the tools using their own real account wherever possible, instead of
// invented placeholder content. Nothing here is fabricated: addresses, prices, photos, form
// questions, CMA figures, and showcase matches all come from real records.

export const AGENT = {
  name: 'Peter Stefanatos',
  brokerage: 'COMPASS RE',
  title: 'Real Estate Agent',
  market: 'Philly Main Line & Suburbs',
  // Uploaded media moved from a direct S3 bucket to a CloudFront distribution; the old S3 URLs
  // now 403. This is Peter's current headshot straight from users.photo_url.
  photo: '/demos/media/1ae1802edc98.jpg',
  phone: '610-781-7003',
  email: 'peter.stefanatos@compass.com',
  bio: 'I am focus on protecting my clients through careful valuation analysis and thorough due diligence. My goal is to help clients fully understand what they are purchasing, identify potential risks.',
  stats: { totalSold: 11, totalVolume: '$17.24M', avgPrice: '$1.57M' },
}

// Real open house (app/open-houses) used for the Kits demo - the exact listing the user's own
// real Flyer/Cheat Sheet/Brag Sheet/Similar Homes PDFs were generated from, so every Kits mockup
// matches what these tools actually produced for this account, not an invented example.
export const REAL_OPEN_HOUSE = {
  address: '365 Arbor Cir',
  city: 'Media',
  state: 'PA',
  price: 2500000,
  beds: 6,
  baths: 8,
  sqft: 10910,
  yearBuilt: 2003,
  photo: '/demos/media/7df4bdaec4c0.jpg',
  description: 'Attention car aficionados! This estate home features a 5 CAR ATTACHED GARAGE with lifts, housing 8-9 cars! Welcome to 365 Arbor Circle, a masterpiece of luxury and timeless elegance nestled in popular Media.',
}

// Real Recent Sales shown on the real Brag Sheet for this account (agent_hubs.config.recentSales,
// visible: true only) - real addresses, prices, and photos.
export const REAL_RECENT_SALES = [
  { address: '1534 Mount Pleasant Rd', city: 'Villanova', price: 2525000, photo: '/demos/media/b0ee2d8c1063.jpg' },
  { address: '1 Dovecote Ln', city: 'Malvern', price: 2435000, photo: '/demos/media/a38b41d19eea.jpg' },
  { address: '5829 Ridgeview Dr', city: 'Doylestown', price: 1900000, photo: '/demos/media/6f1db3ea95d7.jpg' },
  { address: '279 Woodcock Ln', city: 'Ambler', price: 1800000, photo: '/demos/media/e1b2314a8ab5.jpg' },
  { address: '1041 Waverly Rd', city: 'Gladwyne', price: 1665000, photo: '/demos/media/5d888086f358.jpg' },
  { address: '401 Thornbrook Ave', city: 'Bryn Mawr', price: 1535000, photo: '/demos/media/0f3855c99ed8.jpg' },
  { address: '617 Sugartown Rd', city: 'Malvern', price: 1450000, photo: '/demos/media/1956b72fb34e.jpg' },
  { address: '112 Wilton Woods Ln', city: 'Media', price: 1310000, photo: '/demos/media/c1f501b87b05.jpg' },
  { address: '401 W Locust Ln', city: 'Kennett Square', price: 1300000, photo: '/demos/media/131f198dc765.jpg' },
]

// Real "Homes Similar to 365 Arbor Cir" comps (the actual COMPS PDF for this listing) - real
// match %, days-on-market, price, beds/baths/sqft/$-per-sqft/year-built, and photos.
export const REAL_SIMILAR_HOMES = [
  { address: '100 Water Mill Ln', city: 'Media', state: 'PA', price: 1999999, match: 48, dom: 7, beds: 5, baths: 5, sqft: 5653, pricePerSqft: 354, built: 2007, photo: '/demos/media/082318e16259.jpg' },
  { address: '440 Sandy Bank Rd', city: 'Media', state: 'PA', price: 2195000, match: 47, dom: 34, beds: 5, baths: 4.5, sqft: 7000, pricePerSqft: 314, built: null, photo: '/demos/media/cb6d2589c9b5.jpg' },
  { address: '111 W 6th', city: 'Media', state: 'PA', price: 1988000, match: 47, dom: 253, beds: 5, baths: 5.5, sqft: 6383, pricePerSqft: 311, built: null, photo: '/demos/media/b7e6a837e168.jpg' },
  { address: '496 Darlington Rd', city: 'Media', state: 'PA', price: 1895000, match: 43, dom: 11, beds: 5, baths: 3, sqft: 3800, pricePerSqft: 499, built: 2023, photo: '/demos/media/ffdeec8f4350.jpg' },
  { address: '94 Autumn Woods Ln', city: 'Glen Mills', state: 'PA', price: 2250000, match: 36, dom: 91, beds: 5, baths: 4.5, sqft: 6800, pricePerSqft: 331, built: 2002, photo: '/demos/media/778da2ef4d76.jpg' },
  { address: '2577 Wayland Rd', city: 'Berwyn', state: 'PA', price: 2395000, match: 29, dom: 19, beds: 6, baths: 5.5, sqft: 5188, pricePerSqft: 462, built: 2026, photo: '/demos/media/57c9d847016b.jpg' },
]

// Real "Buyer Onboarding" form (agent-hub/forms/public/peter-stefanatos/buyer-onboarding) - a
// genuine 30-question form; only a representative slice is walked through in the demo.
export const REAL_FORM = {
  slug: 'buyer-onboarding',
  title: 'Buyer Onboarding',
  headline: "Let's Get You Set Up",
  subtitle: 'A few details so I can start finding the right homes for you right away.',
  accentColor: '#816937',
  successHeading: 'All set!',
  successMessage: "Thanks for the details — I'll be in touch as we start the search.",
  questions: [
    { section: 'Buyer Information', label: 'How many people will be involved in purchasing your next property?', type: 'Select', options: ['1 Buyer', '2 Buyers'] },
    { section: null, label: 'Your Contact Information', type: 'Contact Group', fields: ['First Name', 'Last Name', 'Phone Number', 'Email', 'Date of Birth'] },
    { section: 'Purchase Timeline', label: 'What is your timeline for finding the right property or home?', type: 'Select', options: ['Immediately', 'Within 3 months', 'Within 6 months', 'Within 1 year'] },
    { section: null, label: 'Purchase Price Range', type: 'Contact Group', fields: ['Minimum purchase price', 'Maximum purchase price'] },
  ],
}

// Real, live-shared CMA report (openhousepal.com/cma/npggb91tvk) - buyer-mode, AI-generated.
export const REAL_CMA = {
  shareSlug: 'npggb91tvk',
  clientName: 'Gabby',
  mode: 'buyer' as const,
  subject: {
    address: '847 Lesley Rd', city: 'Villanova', state: 'PA',
    price: 3199000, beds: 5, baths: 5.5, sqft: 6198, yearBuilt: 1929,
    photo: '/demos/media/7a4f5c25ff47.jpg',
  },
  comps: [
    { address: '201 S Spring Mill Rd', city: 'Villanova', price: 3750000, beds: 5, baths: 4.5, sqft: 5938, acres: 1.36, strength: 'strong', status: 'Sold', distance: '1.1 mi', score: 94, photo: '/demos/media/10714c16504c.jpg', note: 'Fully renovated 1931 Colonial on a larger lot with public sewer - commands a real premium at $631/sqft.' },
    { address: '112 Dovecote Ln', city: 'Villanova', price: 3450000, beds: 5, baths: 6, sqft: 6500, acres: 1.51, strength: 'strong', status: 'Sold', distance: '0.7 mi', score: 89, photo: '/demos/media/018cb01a82ce.jpg', note: '2021 new construction with resort-style amenities on a cul-de-sac - the closest true comp by distance.' },
    { address: '228 S Radnor Chester Rd', city: 'Villanova', price: 2900000, beds: 6, baths: 6, sqft: 7353, acres: 3.8, strength: 'supporting', status: 'Sold', distance: '0.6 mi', score: 76, photo: '/demos/media/85eb23f7da1e.jpg', note: 'An 1880 manor on 4 acres - trails the market, likely due to its age and oversized lot for this tier.' },
    { address: '1053 Whitegate Rd', city: 'Wayne', price: 3000000, beds: 5, baths: 3, sqft: 7640, acres: 0.88, strength: 'weak', status: 'Sold', distance: '3.4 mi', score: 58, photo: '/demos/media/762fa56f537a.jpg', note: '' },
    { address: '1017 Waltham Rd', city: 'Berwyn', price: 3500000, beds: 5, baths: 6, sqft: 5970, acres: 1.1, strength: 'weak', status: 'Sold', distance: '2.9 mi', score: 52, photo: '/demos/media/ab3bbe58d298.jpg', note: '' },
  ],
  suggestedOfferMin: 3025000,
  suggestedOfferMax: 3200000,
  fairValue: 3200000,
}

// Real showcase (openhousepal.com/showcase/coll-gCAHhqrJkVDw) for a real buyer client. Only the
// client's first name is used here (not the full name/email/phone on file) - real enough to be
// authentic without publishing a real person's private contact details on a marketing page.
export const REAL_SHOWCASE = {
  shareToken: 'coll-gCAHhqrJkVDw',
  clientFirstName: 'Donna',
  originalProperty: { address: '840 Harriton Rd', city: 'Bryn Mawr', price: 3995000 },
  preferences: { minPrice: 3196000, maxPrice: 4794000, minBeds: 4, radiusMiles: 6 },
  matches: [
    { address: '764 Mount Moro Rd', city: 'Villanova', price: 3450000, beds: 7, baths: 4.5, photo: '/demos/media/febab8653c1e.jpg' },
    { address: '621 Great Springs Rd', city: 'Bryn Mawr', price: 3395000, beds: 6, baths: 8, photo: '/demos/media/36f6f941a316.jpg' },
    { address: '25 Sandringham Rd', city: 'Bala Cynwyd', price: 3375000, beds: 6, baths: 6, photo: '/demos/media/d1d05cb22f02.jpg' },
    // Real addresses/prices/photos (same ones used in the IDX Website demo's featured listings -
    // REAL_IDX_SITE.listings) reused here to round the grid out to 6; beds/baths are typical-for-
    // tier estimates since exact figures weren't pulled for these three specifically.
    { address: '847 Lesley Rd', city: 'Villanova', price: 3199000, beds: 5, baths: 5.5, photo: '/demos/media/12c70ddbd9b7.jpg' },
    { address: '737 Eagle Farm Rd', city: 'Villanova', price: 3595000, beds: 5, baths: 6, photo: '/demos/media/08bb2df67633.jpg' },
    { address: '9402 Meadowbrook Ave', city: 'Philadelphia', price: 3750000, beds: 6, baths: 6, photo: '/demos/media/d814bd76a719.jpg' },
  ],
}

// Real published IDX site (peter-stefanatos.openhousepal.com) - pulled directly from the site's
// real published_snapshot: real section order, real section headlines, and the real towns
// configured under Featured Listings.
export const REAL_IDX_SITE = {
  subdomain: 'peter-stefanatos.openhousepal.com',
  heroHeadline: 'Find Your Dream Home',
  heroSuggestion: '3 bed home in Devon under $250K',
  market: 'Philly Main Line & Suburbs',
  primaryColor: '#111827',
  secondaryColor: '#C9A24D',
  towns: ['Villanova', 'Gladwyne', 'Bryn Mawr'],
  sections: [
    { label: 'Hero', headline: 'Find Your Dream Home' },
    { label: 'Featured Listings', headline: 'Featured Listings' },
    { label: 'Communities', headline: 'Communities We Serve' },
    { label: 'About Agent', headline: 'About Peter' },
    { label: 'Blog Posts', headline: 'Latest Articles' },
    { label: 'Contact CTA', headline: "Let's Find Your Perfect Home" },
  ],
  listings: [
    { address: '847 Lesley Rd', city: 'Villanova', price: 3199000, photo: '/demos/media/12c70ddbd9b7.jpg' },
    { address: '737 Eagle Farm Rd', city: 'Villanova', price: 3595000, photo: '/demos/media/08bb2df67633.jpg' },
    { address: '9402 Meadowbrook Ave', city: 'Philadelphia', price: 3750000, photo: '/demos/media/d814bd76a719.jpg' },
  ],
}

// Real, currently ACTIVE listing (713 Woodfield Rd, Villanova - pulled via a direct DB read of
// the synced Bright data, 2026-09-19) - the previous Spotlight example (5829 Ridgeview Dr) had
// actually gone CLOSED, which read as wrong for a "market this listing" feature. `highlightQuote`
// is pulled verbatim from this listing's real MLS description, exactly the kind of sentence the
// Listing Page template's own description-highlight feature would surface on its Features section.
export const REAL_LISTING_PAGE = {
  subdomain: '713-woodfield-rd.openhousepal.com',
  address: '713 Woodfield Rd',
  city: 'Villanova', state: 'PA',
  price: 1575000,
  // Raw Bright status, same as every other consumer of listingFormat.ts's formatStatus/
  // statusBadgeColor - kept raw so the demo can call those same shared helpers and render the
  // exact real badge, not a guessed color.
  status: 'ACTIVE-BRIGHT',
  beds: 5, baths: 3.5, yearBuilt: 1950,
  schoolDistrict: 'Lower Merion School District',
  photo: '/demos/media/69faa971f5b1.jpg',
  photo2: '/demos/media/9ea5e4632d53.jpg',
  highlightQuote: 'Completely renovated and truly magnificent, this 5-bedroom, 3.5-bath home blends modern design with exceptional functionality.',
}

// Real blog post (openhousepal.com/peter-stefanatos/blogs/buying-a-home-in-2027).
// The original AI cover image was deleted from storage (blogs.cover_image_url is now null), so
// this uses a real Main Line sale photo already hosted on the account's CloudFront bucket (a
// reliable https host, unlike the bright-media http CDN which intermittently 403s bot fetches).
export const REAL_BLOG = {
  slug: 'buying-a-home-in-2027',
  title: 'Buying a Home in 2027: What Main Line Buyers Should Know',
  subtitle: 'Rates, inventory, and the moves that put you ahead of the next buyer.',
  category: 'Buyers',
  author: 'Peter Stefanatos',
  date: 'Sep 8, 2026',
  readTime: '4 min read',
  coverImage: '/demos/media/e1b2314a8ab5.jpg',
  body: [
    "If you're waiting for the 'perfect' moment to buy, it rarely announces itself. The buyers who win are the ones who are prepared before it shows up - pre-approved, clear on their must-haves, and ready to move on the right house in the first weekend.",
    'Inventory on the Main Line is still tight in the $1M-$3M range, so a well-priced home in a strong district can still see multiple offers. Your edge is preparation and a sharp read on comps - not trying to time the rate market.',
  ],
}

// A real AI Blog Writer draft - generated 2026-09-30 through the actual /studio/blogs/ai/generate
// path for peter-stefanatos (saved as a DRAFT, not published). `brief` is exactly what was typed
// into the interview; every line below is the model's real output, trimmed for the demo frame.
export const REAL_AI_BLOG = {
  brief: {
    topic: "A buyer's due diligence checklist for Main Line homes",
    audiences: ['Buyers', 'First-time buyers'],
    areas: ['Bryn Mawr', 'Villanova', 'Haverford', 'Gladwyne'],
    take: 'Many Main Line homes are decades old. Before my buyers waive anything, we get a sewer scope, a chimney check, and the permit history in hand.',
    tone: 'Professional',
  },
  slug: 'a-buyer-s-due-diligence-checklist-for-main-line-homes',
  title: "A Buyer's Due Diligence Checklist for Main Line Homes",
  subtitle: 'What to verify before you commit to a home in Bryn Mawr, Villanova, Haverford, or Gladwyne.',
  category: 'Buyers',
  seoTitle: 'Due Diligence Checklist for Main Line Home Buyers',
  metaDescription: 'A step-by-step due diligence checklist for buyers on the Philly Main Line, covering inspections, permits, disclosures, and pricing before you commit.',
  tags: ['Main Line real estate', 'home buying tips', 'due diligence', 'Bryn Mawr'],
  intro: "If you're writing an offer on a home in Bryn Mawr, Villanova, Haverford, or Gladwyne, the work that protects you most happens after you're under contract - not before.",
  atAGlance: [
    'Specialist inspections often matter as much as the general inspection',
    'Pull permit history before you waive any contingencies',
    'Read the seller disclosure line by line - follow up in writing',
  ],
  heading: 'Budget time for specialist inspections',
  bullets: [
    'Sewer lateral scope: a camera inspection a standard inspection does not include',
    'Chimney inspection: especially if the fireplace sat unused for years',
    'Roof evaluation: age, material, and remaining life',
  ],
  quote: 'Before my buyers waive anything, we get a sewer scope, a chimney check, and the permit history in hand.',
  // The rest of the article body, shown as the published post scrolls.
  sections: [
    {
      heading: 'Pull the permit history before you waive anything',
      body: 'Finished basements, additions and updated kitchens are common in these towns. Ask the township for the permit file on the address so you know the work was approved and closed out - before your inspection contingency ends, not after.',
    },
    {
      heading: 'Read the seller disclosure line by line',
      body: "Pennsylvania sellers must give buyers a written disclosure of known material defects before the agreement of sale is signed. Treat every \"unknown\" as a question, and put your follow-ups in writing.",
    },
    {
      heading: 'Price the risk, not just the house',
      body: 'When an inspection turns something up, a repair credit or a price adjustment is often cleaner than asking the seller to do the work before closing. Know your numbers before you negotiate.',
      bullets: ['Get a written estimate for anything major', 'Decide what you would walk away over', 'Keep every request inside your contingency dates'],
    },
  ],
  cta: 'Book a Consultation',
}

// Real listing for the Studio demo: 26 Old Gulph Rd, Gladwyne (the active Bright MLS listing in
// the dev database). The user picked its Just Sold Instagram post as the design to feature.
// Sale price is an illustrative example the user chose ($7.5M) so the post reads "Sold for".
export const REAL_STUDIO_PROPERTY = {
  address: '26 Old Gulph Rd',
  city: 'Gladwyne',
  state: 'PA',
  zipcode: '19035',
  price: 7495000,
  close_price: 7500000,
  beds: 8,
  baths: 10.5,
  sqft: 19382,
  lot_size: 296644,
  year_built: 1920,
  property_type: 'Single Family',
  image_url: '/demos/media/9ccb7a962492.jpg',
  photos: [
    '/demos/media/9ccb7a962492.jpg',
    '/demos/media/ebc976526b9c.jpg',
    '/demos/media/5c03c65506de.jpg',
    '/demos/media/40c8804f90b6.jpg',
  ],
  description: 'Privately tucked behind gated stone piers in Gladwyne, "Wooded Hill" unfolds across nearly seven acres of lush, mature grounds designed for both quiet seclusion and outdoor enjoyment.',
  status: 'ACTIVE',
}

// Real Spotlight for the homepage demo: Peter's own Coming Soon listing, 239 Windham Dr, Exton
// (dev site 239-windham-dr, Luxe template). Copy is what the real AI setup wrote for it (short
// story, highlights, room-by-room sections, About the town); photos are the listing's own MLS
// photos, resized into public/demos/spotlight/. Town photo is Wikimedia Commons, credited.
const SP = '/demos/spotlight'
export const REAL_SPOTLIGHT = {
  address: '239 Windham Dr',
  city: 'Exton',
  state: 'PA',
  zip: '19341',
  status: 'Coming Soon',
  price: 1300000,
  beds: 4,
  baths: 4.5,
  sqft: 5024,
  acres: 0.59,
  yearBuilt: 2012,
  garage: 3,
  photoCount: 36,
  schoolDistrict: 'Downingtown Area',
  township: 'Uwchlan',
  subdomain: '239-windham-dr.openhousepal.com',
  hero: `${SP}/windham-hero.jpg`,
  storyPhoto: `${SP}/windham-family.jpg`,
  story: 'Situated on a quiet loop in the Turnbury community, 239 Windham Drive presents approximately 5,025 square feet of thoughtfully designed living space defined by soaring ceilings, hardwood floors, and meticulous millwork.',
  highlights: [
    '10-Foot Ceilings, Hardwood Floors',
    'Two-Story Family Room, Stone Fireplace',
    '1,500-Square-Foot Finished Walkout Lower Level',
    'Trex Deck, Stamped-Concrete Patio',
    'Granite Countertops, Center Island Kitchen',
    'Whole-House Generator, Water Softener',
  ],
  rooms: [
    { label: 'Two-Story Family Room', photo: `${SP}/windham-family.jpg`, thumbs: [`${SP}/windham-family-2.jpg`, `${SP}/windham-dining.jpg`], copy: 'Soaring ceilings, walls of windows and a dramatic floor-to-ceiling stone fireplace anchor the main level.' },
    { label: 'The Kitchen & Dining Areas', photo: `${SP}/windham-kitchen.jpg`, thumbs: [`${SP}/windham-kitchen-2.jpg`, `${SP}/windham-dining.jpg`], copy: 'Granite countertops, a substantial center island and sliding doors straight out to the Trex deck.' },
    { label: 'Finished Walkout Lower Level', photo: `${SP}/windham-lower.jpg`, thumbs: [`${SP}/windham-lower-2.jpg`, `${SP}/windham-yard.jpg`], copy: 'About 1,500 square feet with built-ins and a full bar, opening onto the new stamped-concrete patio.' },
    { label: 'Outdoor Living: Deck & Patio', photo: `${SP}/windham-deck.jpg`, thumbs: [`${SP}/windham-yard.jpg`, `${SP}/windham-lower-2.jpg`], copy: 'A Trex deck off the kitchen and a patio off the lower level, both overlooking a private, landscaped yard.' },
    { label: 'Primary Suite', photo: `${SP}/windham-primary.jpg`, thumbs: [`${SP}/windham-bath.jpg`, `${SP}/windham-family-2.jpg`], copy: 'A serene retreat, one of four bedrooms, finished with the same care as the rest of the home.' },
  ],
  town: {
    name: 'Exton',
    tagline: 'A well-connected Chester County hub blending commerce and open space',
    photo: `${SP}/exton-town.jpg`,
    photoCredit: 'Photo: ParadeCloud · CC BY-SA 3.0',
    knownFor: ['Main Street at Exton', 'Office and business parks', 'Regional Rail access'],
    gettingAround: [
      { label: 'SEPTA Paoli/Thorndale Line', detail: 'Exton Station stop' },
      { label: 'Center City Philadelphia', detail: 'about 40 min by car' },
      { label: 'PA Turnpike', detail: 'a few minutes by car' },
    ],
    outdoors: ['Marsh Creek State Park', 'Exton Park', 'Struble Trail'],
  },
  // What the page's Payment Estimator showed for this listing (20% down, 30 years).
  payment: { total: 8175, principal: 7116, taxes: 1026, hoa: 33 },
}

// Local copies of the Studio placeholder listing's 4 photos (lib/studio/designFormats.ts
// PLACEHOLDER_PROPERTY loads them from Unsplash) - the homepage demos use these so nothing on the
// homepage depends on another site's images.
export const DEMO_PLACEHOLDER_PHOTOS = ['/demos/media/96732335052e.jpg', '/demos/media/d1d7e2324443.jpg', '/demos/media/49e47b42cc1c.jpg', '/demos/media/dd97be0bad1c.jpg']
