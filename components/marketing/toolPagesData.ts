export type ToolPage = {
  slug: string; demo: string; label: string; seoTitle: string; title: string; description: string; plans: string
  why: { title: string; text: string }[]
  steps: string[]
  faqs: { q: string; a: string }[]
  article?: { href: string; label: string }
}

// What each tool's details say on the Tools page, and its own address for Google (owner, 11/05). Only what
// the product does today.
export const TOOL_PAGES: ToolPage[] = [
  {
    slug: 'open-house-sign-in', demo: 'signin', label: 'Open House Sign-In', seoTitle: 'QR Code Open House Sign-In for Agents', title: 'Open house sign-in that turns visitors into leads',
    description: 'QR code open house sign-in for real estate agents. Visitors sign in on their phone with no app, and every visitor lands in your Leads.',
    plans: 'Included on every plan.',
    why: [
      { title: 'No app, no clipboard mess', text: 'One scan opens your sign-in on their own phone, so you get names and contact details you can actually read.' },
      { title: 'Every visitor becomes a lead', text: 'Sign-ins flow straight into your Leads, ready for follow-up, instead of sitting on paper in your car.' },
      { title: 'A Showcase for buyers without an agent', text: 'On Premium and IDX, a visitor without an agent can get a personalized Showcase of similar listings, with an invite after the open house. You switch this on or off for each open house.' },
      { title: 'A full kit in minutes', text: 'Enter an address and get a QR Sign-In Sheet and Brag Sheet, plus a Cheat Sheet and Similar Homes flyer on Bright MLS plans.' },
    ],
    steps: ['Enter the address and create your kit', 'Print or show your QR code at the door', 'Visitors scan and sign in on their phone', 'Follow up from your Leads'],
    faqs: [
      { q: 'Do visitors need to download an app?', a: 'No. They scan the QR code and sign in on their phone in seconds.' },
      { q: 'Can I use this without Bright MLS?', a: 'Yes. The No-MLS plans include sign-in and a Brag Sheet using property details and sales you enter yourself.' },
      { q: 'Can I use a tablet at the door?', a: 'Yes. Kiosk mode shows the sign-in form on your tablet and resets after each guest, or shows a QR code guests scan with their own phone.' },
      { q: 'What if a guest would rather use paper?', a: "Print the Clipboard sheet. It asks the same questions on paper, but paper sign-ins aren't typed in for you, so ask guests to scan when you can." },
    ],
    article: { href: '/resources/how-to-run-an-open-house-that-gets-leads', label: 'How to run an open house that gets leads' },
  },
  {
    slug: 'cma', demo: 'cma', label: 'CMA', seoTitle: 'CMA Software for Real Estate Agents', title: 'CMA reports your sellers can follow',
    description: 'CMA software for real estate agents. Create branded CMA reports with comp analysis, market insights and supported pricing, as a PDF or a web page.',
    plans: 'Included on Basic, Premium and IDX.',
    why: [
      { title: 'Comps with the reasoning', text: 'See the comp analysis and market insights behind the suggested price, so you can explain the number to a seller.' },
      { title: 'Client-ready from the start', text: 'A polished presentation branded to you, with no reformatting before the appointment.' },
      { title: 'Print it or share it', text: 'Download a PDF for printing, or share it as its own web page your client can open from a link.' },
      { title: 'For sellers or buyers', text: 'Set a list price for a seller, or shape an offer for a buyer, from the same CMA builder.' },
    ],
    steps: ['Enter the home', 'Review the comps and market insights', 'Check the supported pricing', 'Download the PDF or share the link'],
    faqs: [
      { q: 'Is a CMA the same as an appraisal?', a: 'No. A CMA is a market analysis, not a formal appraisal.' },
      { q: 'Can my client view it online?', a: 'Yes. A CMA can be downloaded as a PDF or shared as its own viewable web page.' },
      { q: 'Can I change the comps?', a: 'Yes. The top matches are picked for you, and you can add or remove comps, up to 5 per CMA.' },
      { q: 'Can I change the suggested price?', a: 'Yes. The pricing fills in once the AI analysis runs, and your own numbers always override it.' },
    ],
    article: { href: '/resources/how-to-present-a-cma-sellers-trust', label: 'How to present a CMA sellers trust' },
  },
  {
    slug: 'showcases', demo: 'showcase', label: 'Showcases', seoTitle: 'Client Home Search Showcases for Agents', title: 'A home search your clients will actually use',
    description: 'Showcases give real estate clients a personal home-search hub. They react to homes and request tours, and new matches are added automatically.',
    plans: 'Included on Premium and IDX.',
    why: [
      { title: 'New homes arrive on their own', text: 'Matching listings are added automatically, so clients keep coming back to you during the whole search.' },
      { title: 'See what they really think', text: 'Clients like, dislike and comment on homes, and you see every reaction as it happens.' },
      { title: 'Tour requests from any home', text: 'Clients request a tour right from the home they want to see.' },
      { title: 'Made for you after open houses', text: 'When Guest Showcases is on, one is created automatically for each guest who signs in without an agent.' },
    ],
    steps: ['Add your client', 'Set the towns, price and beds', 'Watch their likes and comments come in', 'Confirm tours as they ask'],
    faqs: [
      { q: 'Does my client need an account?', a: 'No. They open their Showcase from the link you send them.' },
      { q: 'Can I turn off emails to a client?', a: 'Yes. You choose whether a client gets their emails, and you can stop them anytime.' },
      { q: 'How many homes can a Showcase hold?', a: 'The best 100 for-sale homes that match. Homes your client liked, commented on or asked to tour always stay on top.' },
      { q: 'How often does my client get emailed?', a: 'At most one email a day, and only on days with new homes or price drops. You can switch everyone to once a week.' },
    ],
    article: { href: '/resources/what-to-do-in-the-48-hours-after-an-open-house', label: 'What to do in the 48 hours after an open house' },
  },
  {
    slug: 'agent-hub', demo: 'agenthub', label: 'Agent Hub', seoTitle: 'Agent Hub: One Link for Real Estate Agents', title: 'One link for everything about you',
    description: 'Agent Hub is a branded one-page site for real estate agents with socials, listings, sales, videos, blogs and a one-tap Save Contact card.',
    plans: 'Included on No-MLS Premium, Premium and IDX.',
    why: [
      { title: 'It keeps up with you', text: 'On Premium and IDX, your hub keeps up as your Bright MLS listings and sales change. On No-MLS Premium, you add your own.' },
      { title: 'Save Contact in one tap', text: 'Clients save your details straight to their phone, so your number stays with them.' },
      { title: 'Your forms and reviews, in one place', text: 'Buyers, sellers and home value requests all start here, and you can show your best reviews beside them.' },
      { title: 'Your videos and blogs, too', text: 'Add your YouTube videos, house tours and blogs, then drag each section into the order you like.' },
    ],
    steps: ['Add your photo and details', 'Pick your look and color', 'Choose your link', 'Put it in your bio, emails and QR codes'],
    faqs: [
      { q: 'Can I pick my own link?', a: 'Yes. You choose the ending of your Agent Hub link. You can change it later, and your last link keeps working.' },
      { q: 'Do I need a website to use it?', a: 'No. Your Agent Hub works by itself, with or without an IDX website.' },
      { q: 'What do people get when they tap Save Contact?', a: 'Your contact card saves to their phone with your name, plus the details you choose, like your mobile, email, brokerage and photo.' },
      { q: 'Can I change how it looks?', a: 'Yes. Use your Brand Kit or pick a color, choose light Ivory or dark Midnight pages, and place your photo on top or beside your name.' },
    ],
  },
  {
    slug: 'open-house-kits', demo: 'kits', label: 'Open House Kits', seoTitle: 'Open House Kits for Real Estate Agents', title: 'A full open house kit from one address',
    description: 'Enter an address and get a QR Sign-In Sheet, Brag Sheet, Cheat Sheet and Similar Homes flyer, ready to print. Cheat Sheet and Similar Homes are on Bright MLS plans.',
    plans: 'Included on every plan. Cheat Sheet and Similar Homes need a Bright MLS plan.',
    why: [
      { title: 'Your pieces at once', text: 'A Sign-In Sheet and Brag Sheet from a single address, plus a Cheat Sheet and Similar Homes flyer on Bright MLS plans.' },
      { title: 'Made ready for you', text: 'Your name and brokerage go on the Sign-In Sheet, Cheat Sheet and Brag Sheet, so nothing needs reformatting before you print.' },
      { title: 'Scannable codes', text: 'The Sign-In Sheet, Cheat Sheet and Similar Homes all carry scannable codes, and the Brag Sheet does on plans with an Agent Hub.' },
      { title: 'One kit, every open house', text: "Kits aren't dated, so you reuse the same kit and QR code each time you open that home. No reprinting." },
    ],
    steps: ['Enter the address', 'Pick your photos and similar homes', 'Print or share each piece', 'Set them out at the open house'],
    faqs: [
      { q: 'Can I use kits without Bright MLS?', a: 'Yes. The No-MLS plans give you the Sign-In Sheet and Brag Sheet from the details and sales you enter yourself. Cheat Sheet and Similar Homes need a Bright MLS plan.' },
      { q: 'Can I print them myself?', a: 'Yes. Every piece has a Print button, or you can download a print-ready PDF.' },
      { q: 'What if the price changes?', a: 'On Bright MLS plans, tap Refresh to pull the latest price onto the flyer. Similar Homes also refreshes and drops homes that sold or left the market.' },
      { q: "Can I use a kit when I host someone else's listing?", a: 'Yes, on Bright MLS plans. Once the listing agent approves you to host, build a kit for that home, and the guests who sign in are your leads.' },
    ],
  },
  {
    slug: 'forms', demo: 'forms', label: 'Forms', seoTitle: 'Lead Capture Forms for Real Estate Agents', title: 'Branded forms for any situation',
    description: 'Create branded forms for seller onboarding, Facebook ads, website funnels, mailers and open houses. Every response flows into your Leads.',
    plans: 'Included on every plan.',
    why: [
      { title: 'Made for how you work', text: 'Seller onboarding, Facebook ads, website funnels, mailers, open houses and more.' },
      { title: 'One link or QR code', text: 'Share the link or print the code. A scan opens the form right up.' },
      { title: 'Straight into your Leads', text: 'Every response lands in your Leads, ready for follow-up.' },
      { title: 'See where people drop off', text: 'Stats show views, submissions and the exact question where people leave, so you know what to change.' },
    ],
    steps: ['Pick a form or start your own', 'Customize the questions', 'Share the link or QR code', 'See responses in your Leads'],
    faqs: [
      { q: 'Can I change the questions?', a: 'Yes. On your own form, or a copy of a premade one, you can add and change questions. A few core ones, like contact details, stay in place.' },
      { q: 'Can I track a mailer or ad on its own?', a: 'Yes. A campaign gives the same form its own link, QR code and stats, so each mailer or ad is counted separately.' },
      { q: "What if someone starts a form but doesn't finish?", a: 'If they left their contact info, they show under Unfinished responses, and Add to Leads puts them in your Leads.' },
      { q: 'Can my forms match my brand?', a: 'Yes. Forms follow your Brand Kit by default, or you can give one its own color and a light or dark look.' },
    ],
  },
  {
    slug: 'email-signature', demo: 'signature', label: 'Signature', seoTitle: 'Live Email Signature for Real Estate Agents', title: 'A signature that keeps itself current',
    description: 'A mini Agent Hub at the bottom of every email. Your active listing or a recent sale rotates in automatically in Gmail and Outlook on the web.',
    plans: 'Included on No-MLS Premium and IDX. No-MLS Premium shows the listings and sales you add by hand.',
    why: [
      { title: 'A mini Agent Hub in every email', text: 'Your details and links sit at the bottom of everything you send.' },
      { title: 'It rotates by itself', text: 'Your active listing or a recent sale changes automatically in Gmail and Outlook on the web, with no re-pasting.' },
      { title: 'It travels with you', text: 'Your Signature also carries through many other OpenHousePal tools.' },
      { title: 'Buttons to your real forms', text: "Beside My Agent Hub, add up to two buttons like What's My Home Worth?, and each one opens your current form." },
    ],
    steps: ['Build your signature', 'Add it to Gmail or Outlook once', 'Send email as usual', 'It keeps itself up to date'],
    faqs: [
      { q: 'Do I have to paste it in again when a listing changes?', a: 'Not in Gmail or Outlook on the web. New listings and sales show up by themselves. Outlook desktop and Apple Mail keep their own copy of the pictures, so we tell you when to re-copy. Changes to your text or colors need a re-copy in any app.' },
      { q: 'Which email apps does it work in?', a: "Gmail, Outlook on the web, Outlook desktop and Apple Mail. You copy it once and paste it straight into the app's signature box." },
      { q: "What shows when I don't have an active listing?", a: 'Your recent sales show instead, and your active listing comes back as soon as you have one.' },
      { q: 'Can it show my sales stats?', a: 'Yes. Show your volume, closed count and average price, on the right edge of the card or as a slim strip under your name.' },
    ],
  },
  {
    slug: 'discovery', demo: 'discovery', label: 'Discovery', seoTitle: 'Find Open Houses to Host', title: 'Find open houses to host',
    description: 'Find listings near you that fit what you want to host, starting with your own brokerage, then send the listing agent a hosting request in a few taps.',
    plans: 'Included on Basic, Premium and IDX.',
    why: [
      { title: 'Starts with your brokerage', text: "See the ones that match what you're looking to host and filter down to the best fits." },
      { title: 'Ask in a few taps', text: "Send the listing agent a hosting request without calling around. If they aren't on OpenHousePal, we write the note and you send it by text or email." },
      { title: 'Every answer in one place', text: 'Approvals, declines and counter-offers are all tracked together.' },
      { title: 'Your search, saved', text: 'Set your area, price, bedrooms and brokerages once. Discovery saves them for next time.' },
    ],
    steps: ['Set what you want to host', 'Filter to the best fits', 'Send a hosting request', 'Track the answers'],
    faqs: [
      { q: 'Whose listings do I see?', a: "It starts with your own brokerage's listings near you. You can add other brokerages with the filter. Agents on OpenHousePal take requests from their own brokerage or team." },
      { q: 'Can I offer two dates at once?', a: 'Yes. Pick one day, or two to offer a second open house, then a time and a short note.' },
      { q: 'What if the listing agent suggests another time?', a: 'You can accept the new time or decline. Each side can suggest another time once, then it comes down to yes or no.' },
      { q: "Why can't I request some listings?", a: 'Some days are already booked, some homes are under contract or not active yet, and some listing agents only take requests from their team.' },
    ],
  },
  {
    slug: 'open-house-manager', demo: 'manager', label: 'Manager', seoTitle: 'Open House Manager for Listing Agents', title: 'Every listing’s open houses on one board',
    description: 'See which weekends need a host, approve or decline agent requests, ask an agent to host, leave host notes and review sign-in stats after each one.',
    plans: 'Included on Basic, Premium and IDX.',
    why: [
      { title: 'One board for all your listings', text: 'See at a glance which weekends still need a host.' },
      { title: 'You stay in charge', text: 'Approve or decline agent requests, or ask a teammate or any agent to host. Leave Host Notes for the lockbox, parking and anything else.' },
      { title: 'See how it went', text: 'Review guest counts and sign-in stats after each open house.' },
      { title: 'Your team first', text: 'Add trusted agents to your team, and choose whether only your team or agents at your brokerage too can ask to host.' },
    ],
    steps: ['See your listings on the board', 'Review hosting requests', 'Find a host', 'Check the stats afterward'],
    faqs: [
      { q: 'Can I leave notes for the host?', a: 'Yes. Host Notes hold the lockbox code, parking, alarm and seller preferences, and approved hosts see them before the open house.' },
      { q: 'Do my listings show up on their own?', a: "Yes. Listings where you're the Bright MLS listing agent appear on the board automatically." },
      { q: 'What happens when I approve a request?', a: 'The host is told, the open house is booked, and other requests for that same day are declined.' },
      { q: "Do I see the host's guest list?", a: 'You see the guest counts for each hosted day. Guest names stay with the host.' },
    ],
  },
  {
    slug: 'studio', demo: 'design', label: 'Studio', seoTitle: 'Real Estate Flyers, Mailers and Social Posts', title: 'Flyers, mailers and social posts in minutes',
    description: 'Create on-brand flyers, mailers and social posts that auto-fill the property details in designer layouts, ready to download and post.',
    plans: 'Included on No-MLS Premium, Premium and IDX.',
    why: [
      { title: 'The details fill themselves in', text: 'Property facts drop into any of the designer layouts for you.' },
      { title: 'On brand every time', text: 'Flyers, mailers and social posts all come out looking like you.' },
      { title: 'Ready for the moment', text: 'Make a "Just Sold" post or a "Make Me Sell" mailer in a few clicks.' },
      { title: 'Know which piece worked', text: 'Put a QR code to one of your forms on a print piece, and its own campaign counts the leads it brings in.' },
    ],
    steps: ["Pick what you're marketing and where it goes", 'Pick the home', 'Pick a layout and color', 'Adjust, then download'],
    faqs: [
      { q: 'Do I need design skills?', a: 'No. The designs are done for you and the property details fill in automatically. On No-MLS Premium, they fill in from the details you enter.' },
      { q: 'What sizes can I make?', a: 'Square, feed and story posts for social, plus flyers, postcards, jumbo postcards, letter mailers and door hangers for print.' },
      { q: 'Do I need a listing to make something?', a: 'No. Home Valuation, Make Me Sell, Find Your Dream Home and Social Media Ad pieces need no listing.' },
      { q: 'Do you print and mail them for me?', a: 'No. Print pieces download as an exact-size PDF at 300 DPI, ready to send to your printer.' },
    ],
  },
  {
    slug: 'media-lab', demo: 'aimedia', label: 'Media Lab', seoTitle: 'AI Twilight Photos and Virtual Staging for Listings', title: 'New listing media from the photos you have',
    description: 'Turn your photos into twilight exteriors, virtually staged rooms, lights-on shots and short videos, with no reshoot.',
    plans: 'Included on No-MLS Premium and IDX.',
    why: [
      { title: 'Twilight exteriors', text: 'A daytime exterior becomes an evening shot.' },
      { title: 'Staged rooms and lights on', text: 'Virtually stage an empty room, or turn the lights on in a dark one.' },
      { title: 'Short videos from your photos', text: 'Turn photos into a short video with gentle camera moves, ready to post the same day.' },
      { title: 'Clean up the clutter', text: 'Remove cars, bins and furniture, clear away leaves and sticks, and brighten the sky and lawn.' },
    ],
    steps: ['Pick a property or upload photos', 'Pick what to make', 'Choose your photos', 'Generate, then download'],
    faqs: [
      { q: 'Do I need a new photo shoot?', a: 'No. It works from the photos you already have, listing photos or your own uploads. On No-MLS Premium you upload your own.' },
      { q: 'Can I mark photos as virtually staged?', a: 'Yes. Add a "Virtually Staged" label to the photo, and change it later without making it again. Use it wherever your MLS requires it.' },
      { q: 'What shapes do videos come in?', a: "Landscape, Vertical, Square or Portrait. Pick one to start, and add the other shapes after it's made." },
      { q: 'Does it use my AI allowance?', a: "Yes. Each run uses part of your monthly AI allowance, and you see about how much before you start. A run that fails isn't charged." },
    ],
  },
  {
    slug: 'blogs', demo: 'blogs', label: 'Blogs', seoTitle: 'AI Local Blog Writer for Real Estate Agents', title: 'Local guides that help people find you first',
    description: 'Answer a few questions and Blog Builder researches your towns, writes an SEO-ready article in your voice and fact-checks it.',
    plans: 'Included on No-MLS Premium, Premium and IDX.',
    why: [
      { title: 'Researched for your towns', text: 'Blog Builder looks up your area before it writes a word.' },
      { title: 'In your voice', text: 'A complete, SEO-ready article from a few quick questions.' },
      { title: 'Fact-checked', text: "It's fact-checked against real sources, and anything it can't confirm is reworded or left out for you. You can end it with your sales or listings in that area." },
      { title: 'Publish now or later', text: 'Publish it to your Agent Hub, and to your website on IDX, or schedule it for a day and time you pick.' },
    ],
    steps: ['Answer a few questions', 'Let it research and write', 'Read it over', 'Publish'],
    faqs: [
      { q: 'Do I have to write anything?', a: 'Just answer a few quick questions. You read it over before it goes out.' },
      { q: 'How long does it take?', a: 'Usually 2 to 4 minutes. You can keep working, and your bell lights up when the draft is ready.' },
      { q: 'Will it make up numbers?', a: "It's built not to. Add the numbers you know are true, and the fact-check lists any numbers to double-check before you publish." },
      { q: 'Can I write it myself instead?', a: 'Yes. Start from scratch with a suggested structure or a blank article, and write it your way.' },
    ],
  },
  {
    slug: 'listing-spotlight', demo: 'listingpage', label: 'Spotlight', seoTitle: 'Single Property Websites for Listings', title: 'A cinematic website for every listing',
    description: 'AI builds a listing its own website, with every photo, the story, a section about the town and an optional room-by-room tour, on its own address.',
    plans: 'Included on IDX.',
    why: [
      { title: 'AI writes the first draft', text: 'Every photo and MLS detail, the standout features, a polished story, a section about the town and an optional room-by-room tour.' },
      { title: 'Its own address and QR code', text: 'One link to share and a code to print for each listing.' },
      { title: 'It stays in sync', text: 'Price, status and open houses update live, and every tour request lands in your Leads.' },
      { title: 'Buyers can follow the home', text: 'Visitors get an email from you when the price drops, an open house is set, or it goes under contract or sells.' },
    ],
    steps: ['Pick your listing', 'AI writes the first draft', 'Check each step and make changes', 'Publish, then share the link or QR code'],
    faqs: [
      { q: 'Do I update it when the price changes?', a: 'No. Price, status and open houses stay synced live.' },
      { q: 'Which homes can get one?', a: "Your own current listings, where you're the listing or co-listing agent. Sold homes and other agents' listings can't." },
      { q: 'Can I add a 3D tour or floor plans?', a: 'Yes. Add a 3D tour link, floor plans, documents like disclosures, and a Media Lab video of the home.' },
      { q: 'Can I take it down for a while?', a: 'Yes. Unpublish takes it offline without deleting anything, and you can publish it again any time.' },
    ],
  },
  {
    slug: 'calendar-crm-sync', demo: 'calsync', label: 'Cal + CRM', seoTitle: 'Calendar and CRM Sync for Real Estate Agents', title: 'Your calendar and CRM, kept up for you',
    description: 'Connect Google Calendar and your CRM once. Open houses, follow-ups and tours land on your calendar, and new leads go to your CRM.',
    plans: 'Included on every plan.',
    why: [
      { title: 'Connect once', text: 'Works with Google Calendar and CRMs like Follow Up Boss, Lofty and kvCORE. Others connect by lead email, webhook or Zapier.' },
      { title: 'Your day fills itself in', text: 'Open houses, follow-up reminders and confirmed tours land on your calendar automatically.' },
      { title: 'Leads reach your CRM', text: 'Every new lead is pushed over with its source tagged.' },
      { title: 'Portal leads come in too', text: 'Forward your Zillow, Realtor.com, Homes.com and Facebook lead emails, and they land in your Leads.' },
    ],
    steps: ['Connect your calendar', 'Connect your CRM', 'Keep working as usual', 'Everything lands where it should'],
    faqs: [
      { q: 'Do I have to stop using my CRM?', a: 'No. New leads are sent to your CRM. Follow Up Boss, Lofty, kvCORE and others are supported, and most others connect by lead email or webhook.' },
      { q: 'Will it touch my other calendars?', a: 'No. It makes its own calendar called OpenHousePal and never touches your other calendars.' },
      { q: 'If I move a follow-up in Google Calendar, does it update?', a: "Yes. Move it to another day or time and it moves in OpenHousePal too. Delete it and it's marked done." },
      { q: 'Can I test it before real leads come in?', a: 'Yes. Save and send a test lead, then check that it shows up in your CRM.' },
    ],
  },
  {
    slug: 'review-hub', demo: 'reviews', label: 'Review Hub', seoTitle: 'Get More Google and Zillow Reviews', title: 'One link for more five-star reviews',
    description: 'One review link for every client: they post to Google and Zillow in one tap, you hear about every review, and your best can show on your Agent Hub.',
    plans: 'Included on No-MLS Premium, Premium and IDX.',
    why: [
      { title: 'One link for every client', text: 'Clients write their review once, then can post it to Google and Zillow in one tap, with their words already copied.' },
      { title: 'You hear right away', text: 'A low rating alerts you and adds a follow-up, so you can reach out and make it right.' },
      { title: 'Your best on show', text: 'Turn it on and your best reviews appear on your Agent Hub.' },
      { title: 'Bring your reviews with you', text: 'Bring in up to 5 Google reviews, or paste reviews from other sites, copied word for word with their original date.' },
    ],
    steps: ['Add your Google and Zillow links once', 'Send your review link', 'Clients post in one tap', 'Show your best on your Agent Hub'],
    faqs: [
      { q: 'What happens with a low rating?', a: "You get an alert and a follow-up right away, so you can reach out and make it right. It stays off your Agent Hub. Like every client, they're also offered Google and Zillow." },
      { q: 'Do I need an Agent Hub first?', a: 'Yes. Set up your Agent Hub first, since your review link and your best reviews live there.' },
      { q: 'How do I send my review link?', a: 'Copy it, text it or email it right from the page. A good habit is sending it after every closing.' },
      { q: 'Can I hide a review?', a: 'Yes. Hide or show any review, or only show 4 and 5 stars. Lower ones stay saved privately.' },
    ],
  },
  {
    slug: 'idx-website', demo: 'idx', label: 'IDX', seoTitle: 'IDX Website for Real Estate Agents', title: 'A complete IDX website, built for you',
    description: 'Full MLS search with a map, a page for every home, neighborhood guides and every inquiry in your Leads, with your own domain if you want one.',
    plans: 'Included on IDX.',
    why: [
      { title: 'Full MLS search', text: 'Search with a map, your featured and newly listed homes, and a page for every home.' },
      { title: 'Neighborhood guides', text: 'Live market data and side-by-side town comparisons, alongside your sales and blogs.' },
      { title: 'Leads come to you', text: 'Showcases visitors build themselves, and every inquiry goes straight into your Leads.' },
      { title: 'Your look, your way', text: 'Pick Classic or Luxe, your colors and light or dark pages, then drag your home page sections into order.' },
    ],
    steps: ['Pick your look', 'Add your towns', 'Publish on your free address', 'Connect your own domain or buy one'],
    faqs: [
      { q: 'Is it on my own domain?', a: 'It starts on a free yourname.openhousepal.com address. You can connect a domain you already own or buy a new one right inside OpenHousePal, and your links move onto it. The domain itself is not included in the plan.' },
      { q: 'How many towns can I add?', a: 'Up to 15. Each town gets its own page with live listings, plus market, school and local details where there is data.' },
      { q: 'Will Google find my site?', a: 'After you publish, OpenHousePal tells Google for you. New sites usually appear within a few days to two weeks.' },
      { q: 'Can I turn it off if I use my own website?', a: 'Yes. Nothing is deleted. Your Agent Hub, open houses and leads keep working, and turning it back on brings it back as published.' },
    ],
    article: { href: '/idx-websites', label: 'See IDX websites' },
  },
]
