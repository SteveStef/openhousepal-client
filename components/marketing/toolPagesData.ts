export type ToolPage = {
  slug: string; demo: string; label: string; seoTitle: string; accent: string; motif: 'qr' | 'star' | 'house' | 'key'; title: string; lead: string; description: string; plans: string
  why: { title: string; text: string }[]
  steps: string[]
  faqs: { q: string; a: string }[]
  article?: { href: string; label: string }
}

// One page each for the tools agents search for by name (owner, 11/05). Only what the product does today.
export const TOOL_PAGES: ToolPage[] = [
  {
    slug: 'open-house-sign-in', demo: 'signin', label: 'Open House Sign-In', seoTitle: 'QR Code Open House Sign-In for Agents', accent: 'into leads', motif: 'qr', title: 'Open house sign-in that turns visitors into leads',
    lead: 'Visitors scan your branded QR code and sign in on their phone in seconds, with no app to download. Every sign-in goes straight into your Leads.',
    description: 'QR code open house sign-in for real estate agents. Visitors sign in on their phone with no app, and every visitor lands in your Leads.',
    plans: 'Included on every plan.',
    why: [
      { title: 'No app, no clipboard mess', text: 'One scan opens your sign-in on their own phone, so you get names and contact details you can actually read.' },
      { title: 'Every visitor becomes a lead', text: 'Sign-ins flow straight into your Leads, ready for follow-up, instead of sitting on paper in your car.' },
      { title: 'A Showcase for buyers without an agent', text: "If a visitor doesn't have an agent, OpenHousePal creates a personalized Showcase from similar listings and invites them to it after the open house." },
      { title: 'A full kit in minutes', text: 'Enter an address and get a Sign-In Sheet, Cheat Sheet, Brag Sheet and Similar Homes flyer, each branded to you with its own QR code.' },
    ],
    steps: ['Enter the address and create your kit', 'Print or show your QR code at the door', 'Visitors scan and sign in on their phone', 'Follow up from your Leads'],
    faqs: [
      { q: 'Do visitors need to download an app?', a: 'No. They scan the QR code and sign in on their phone in seconds.' },
      { q: 'Can I use this without Bright MLS?', a: 'Yes. The No-MLS plans include Open House Kits and Sign-In using property details you enter yourself.' },
    ],
    article: { href: '/resources/how-to-run-an-open-house-that-gets-leads', label: 'How to run an open house that gets leads' },
  },
  {
    slug: 'cma', demo: 'cma', label: 'CMA', seoTitle: 'CMA Software for Real Estate Agents', accent: 'can follow', motif: 'star', title: 'CMA reports your sellers can follow',
    lead: 'Generate a comparative market analysis with comps, market insights and supported pricing, in a polished presentation branded to you.',
    description: 'CMA software for real estate agents. Create branded CMA reports with comp analysis, market insights and supported pricing, as a PDF or a web page.',
    plans: 'Included on Basic, Premium and IDX.',
    why: [
      { title: 'Comps with the reasoning', text: 'See the comp analysis and market insights behind the suggested price, so you can explain the number to a seller.' },
      { title: 'Client-ready from the start', text: 'A polished presentation branded to you, with no reformatting before the appointment.' },
      { title: 'Print it or share it', text: 'Download a PDF for printing, or share it as its own web page your client can open from a link.' },
    ],
    steps: ['Enter the home', 'Review the comps and market insights', 'Check the supported pricing', 'Download the PDF or share the link'],
    faqs: [
      { q: 'Is a CMA the same as an appraisal?', a: 'No. A CMA is a market analysis, not a formal appraisal.' },
      { q: 'Can my client view it online?', a: 'Yes. A CMA can be downloaded as a PDF or shared as its own viewable web page.' },
    ],
    article: { href: '/resources/how-to-present-a-cma-sellers-trust', label: 'How to present a CMA sellers trust' },
  },
  {
    slug: 'showcases', demo: 'showcase', label: 'Showcases', seoTitle: 'Client Home Search Showcases for Agents', accent: 'actually use', motif: 'house', title: 'A home search your clients will actually use',
    lead: 'A Showcase is a living home-search hub you build for a client. They like, comment on and request tours of homes, and new matching listings are added automatically.',
    description: 'Showcases give real estate clients a personal home-search hub. They react to homes and request tours, and new matches are added automatically.',
    plans: 'Included on Premium and IDX.',
    why: [
      { title: 'New homes arrive on their own', text: 'Matching listings are added automatically, so clients keep coming back to you during the whole search.' },
      { title: 'See what they really think', text: 'Clients like, dislike and comment on homes, and you see every reaction as it happens.' },
      { title: 'Tour requests in one tap', text: 'Clients request a tour right from the home they want to see.' },
      { title: 'Made for you after open houses', text: 'One is created automatically whenever someone signs in to an open house without an agent.' },
    ],
    steps: ['Set the towns, price and beds', 'Send your client their link', 'Watch their likes and comments come in', 'Confirm tours as they ask'],
    faqs: [
      { q: 'Does my client need an account?', a: 'No. They open their Showcase from the link you send them.' },
      { q: 'Can I turn off emails to a client?', a: 'Yes. You choose whether a client gets their emails, and you can stop them anytime.' },
    ],
    article: { href: '/resources/what-to-do-in-the-48-hours-after-an-open-house', label: 'What to do in the 48 hours after an open house' },
  },
  {
    slug: 'agent-hub', demo: 'agenthub', label: 'Agent Hub', seoTitle: 'Agent Hub: One Link for Real Estate Agents', accent: 'about you', motif: 'key', title: 'One link for everything about you',
    lead: 'Your branded one-page hub for socials, sales, listings, videos and blogs, with a one-tap Save Contact card so clients keep your number.',
    description: 'Agent Hub is a branded one-page site for real estate agents with socials, listings, sales, videos, blogs and a one-tap Save Contact card.',
    plans: 'Included on No-MLS Premium, Premium and IDX.',
    why: [
      { title: 'It updates itself', text: 'Your hub keeps up as your Bright MLS listings and sales change, so you never rebuild it by hand.' },
      { title: 'Save Contact in one tap', text: 'Clients save your details straight to their phone, so your number stays with them.' },
      { title: 'Your forms and reviews, in one place', text: 'Buyers, sellers and home value requests all start here, with your best reviews beside them.' },
    ],
    steps: ['Add your photo and details', 'Pick your look and color', 'Choose your link', 'Put it in your bio, signature and QR codes'],
    faqs: [
      { q: 'Can I pick my own link?', a: 'Yes. You choose the ending of your Agent Hub link and can change it later.' },
      { q: 'Do I need a website to use it?', a: 'No. Your Agent Hub works by itself, with or without an IDX website.' },
    ],
  },
]
