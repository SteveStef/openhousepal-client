import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'

export type Faq = { q: string; a: string }
export type FaqGroup = { id: string; title: string; items: Faq[] }

// The FAQ page's questions. Plain answers from what the product does today, so check this list when
// a plan, a price or a feature changes.
export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'start', title: 'Getting started',
    items: [
      { q: 'What is OpenHousePal?', a: 'The all-in-one platform for real estate agents. It runs your open houses, follows up with your leads and markets you and your listings, all branded to you.' },
      { q: 'Is there a free trial?', a: `Yes. Basic, Premium and both No-MLS plans start with a ${TRIAL_PERIOD_DAYS}-day free trial, and you can cancel anytime. The IDX plan has no free trial and has a setup fee.` },
      { q: "I don't have Bright MLS access. Can I still use OpenHousePal?", a: `Yes. No-MLS Basic (${PRICING_PLANS.NO_MLS.priceString}/month) gives you Leads, Forms, Calendar and CRM sync, and Open House Kits and Sign-In using property details you enter yourself. No-MLS Premium (${PRICING_PLANS.PRO_NO_MLS.priceString}/month) adds Agent Hub, Studio, Media Lab, Blogs, Review Hub and Signature.` },
    ],
  },
  {
    id: 'plans', title: 'Plans and pricing',
    items: [
      { q: "What's the difference between Basic, Premium and IDX?", a: `Each plan includes everything in the one before it. Basic (${PRICING_PLANS.BASIC.priceString}/month) has Bright MLS integration, Open House Kits and Sign-In, Forms, CMA, Discovery and Manager, and Calendar and CRM sync. Premium (${PRICING_PLANS.PREMIUM.priceString}/month) adds Agent Hub, Showcases, Studio, Blogs and Review Hub. IDX (${PRICING_PLANS.IDX.priceString}/month plus a setup fee) adds a full IDX website, plus Media Lab, Spotlight and Signature.` },
      { q: 'Can I cancel anytime?', a: 'Yes. There is no commitment, and you can cancel whenever you like.' },
    ],
  },
  {
    id: 'openhouses', title: 'Open houses',
    items: [
      { q: 'How does open house sign-in work?', a: "Visitors scan your branded QR code and sign in on their phone in seconds, with no app to download. On Premium and IDX, a visitor without an agent can get a personalized Showcase and an invite to it after the open house. You switch this on or off for each open house." },
      { q: 'What is an Open House Kit?', a: 'Enter an address and get a QR Sign-In Sheet, Brag Sheet, Cheat Sheet and Similar Homes flyer, ready to print and share. Cheat Sheet and Similar Homes need a Bright MLS plan.' },
      { q: 'What do Discovery and Manager do?', a: 'Discovery finds listings near you to host, starting with your own brokerage, and sends the listing agent a request in a couple of taps. Manager shows which of your listings need a host, lets you approve requests, and shows sign-in stats after each open house.' },
    ],
  },
  {
    id: 'clients', title: 'Leads and clients',
    items: [
      { q: 'What is a Showcase?', a: 'A shared home-search hub you make for a client. They like, comment on and request tours of homes, and new matching listings are added automatically, so they stay engaged with you for the whole search. Included on Premium and IDX.' },
      { q: 'What can I do with Forms?', a: 'Create branded forms for seller onboarding, Facebook ads, website funnels, mailers and open houses. Share one link or QR code, and every response flows into your Leads.' },
      { q: 'What is Review Hub?', a: 'One review link for every client. They can post to Google and Zillow in one tap, with their words already copied, and a low rating alerts you right away so you can make it right. Your best reviews can also show on your Agent Hub. Included on No-MLS Premium, Premium and IDX.' },
      { q: 'Does it work with my calendar and CRM?', a: 'Yes. Connect Google Calendar and your CRM once. Open houses, follow-up reminders and confirmed tours land on your calendar, and new leads go to your CRM with their source tagged.' },
    ],
  },
  {
    id: 'marketing', title: 'Your brand and marketing',
    items: [
      { q: "What's included in my Agent Hub?", a: 'Your branded one-page site with socials, sales, current listings, videos and blog posts, all in one shareable link. Included on No-MLS Premium, Premium and IDX.' },
      { q: 'What does Studio do?', a: 'Polished flyers, mailers and social posts that auto-fill from your listing in the style you pick, ready to download in minutes. Included on No-MLS Premium, Premium and IDX.' },
      { q: 'What is a CMA, and is it an appraisal?', a: 'A CMA is a comparative market analysis with comps, market insights and supported pricing, branded to you, as a PDF or its own web page. It is a market analysis, not a formal appraisal.' },
      { q: 'What is Spotlight?', a: 'Pick a listing and AI builds it a cinematic website of its own, with every photo and detail, an optional room-by-room tour and a section about the town. Price, status and open houses stay in sync.' },
    ],
  },
  {
    id: 'idx', title: 'IDX websites',
    items: [
      { q: 'What do I get with an IDX website?', a: 'A complete website built for you and branded to you, with full MLS search on a map, a page for every home, neighborhood guides with live market data, your sales and blogs, and every inquiry in your Leads.' },
      { q: 'Can I use my own domain?', a: 'Yes. Connect a domain you already own, or get a new one. Your links then move onto it. The domain itself is not included in the plan.' },
    ],
  },
]
