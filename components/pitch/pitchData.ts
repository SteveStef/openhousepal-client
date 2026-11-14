import type { ComponentType } from 'react'
import {
  QrCode, MapPin, Images, Printer, ScanLine, UserCheck, Ticket, UserX, Sparkles, Mail, Camera, LayoutList, Share2,
  PenLine, Rocket, ImagePlus, SlidersHorizontal, Globe, Palette, MousePointerClick, Calculator, Send, Download,
  MessagesSquare, Search, ShieldCheck, Link2, Layout, Clapperboard, Newspaper, ClipboardList, Users, BellRing,
  MailOpen, Building2, Star, SwatchBook, TabletSmartphone, Home, ScanSearch, Brush,
  UserPlus, Handshake, BadgeCheck, Film, ListChecks, Hand, Bot, CircleCheck, Inbox, FileText,
} from 'lucide-react'
import { SpotlightIcon, KitsIcon } from '@/components/icons/CustomIcons'

// The hidden brokerage pitch deck (app/pitch/[key]). Every screen shown is a real one: Peter
// Stefanatos' own hub, website, Spotlight, kit sheets, designs and films of the real pages being
// used, captured for the 10/14 ad (the guest / buyer there is the made-up "Sarah Mitchell", never a
// real client). Wording follows the plan cards and the helper guide - if a feature changes, change
// it here too.

export type Icon = ComponentType<{ className?: string; strokeWidth?: number }>
export type Shot = { src: string; w: number; h: number }
export type Clip = { src: string; poster: string; rate?: number }
export type Visual =
  | { type: 'phone'; shot: Shot }
  | { type: 'phoneFilm'; film: Clip }
  | { type: 'scan'; film: Clip }
  | { type: 'twoPhones'; a: Shot; b: Shot }
  | { type: 'laptop'; shot: Shot }
  | { type: 'laptopFilm'; film: Clip }
  | { type: 'screen'; film: Clip }
  | { type: 'tablet'; shot: Shot }
  | { type: 'kit' }
  | { type: 'compare' }
  | { type: 'wall' }

export type Feature = {
  key: string
  icon: Icon
  kicker: string
  ai?: boolean
  title: string
  line: string
  steps: { icon: Icon; label: string }[]
  why: string[]
  visual: Visual
}

const P = '/pitch'
const ML = '/demos/media-lab'
export const FEATURES: Feature[] = [
  {
    key: 'kit', icon: KitsIcon, kicker: 'Open House Tools', title: 'Open House Kit',
    line: 'Type an address. Everything for Sunday is ready to print.',
    steps: [{ icon: MapPin, label: 'Type the address' }, { icon: Images, label: 'Pick the photos' }, { icon: Printer, label: 'Print the kit' }],
    why: ['Sign-in sheet, Cheat Sheet, Brag Sheet and Similar Homes', 'One kit per home, reused for every open house', 'Carries the agent’s name and your brokerage'],
    visual: { type: 'kit' },
  },
  {
    key: 'signin', icon: QrCode, kicker: 'Open House Tools', title: 'Instant Sign In',
    line: 'Guests scan the sign-in sheet and sign in on their own phone.',
    steps: [{ icon: ScanLine, label: 'Guest scans the code' }, { icon: UserCheck, label: 'Signs in, 10 seconds' }, { icon: Ticket, label: 'Guest Pass opens' }],
    why: ['No app to download. Any phone, or a tablet kiosk', 'Every guest becomes a lead with a follow-up ready', 'It asks if they have an agent, so you know who to call'],
    visual: { type: 'scan', film: { src: `${P}/film-signin.mp4`, poster: `${P}/film-signin-poster.jpg`, rate: 0.6 } },
  },
  {
    key: 'pass', icon: Ticket, kicker: 'Open House Tools', title: 'Guest Pass',
    line: 'Every guest leaves with the home in their pocket.',
    steps: [{ icon: UserCheck, label: 'Guest signs in' }, { icon: Ticket, label: 'Their pass opens' }, { icon: Hand, label: 'They tap what they want' }],
    why: ['The Cheat Sheet and similar homes, live on their phone', 'One tap asks for the seller disclosure or a second tour', 'Every tap comes straight back to the agent'],
    visual: { type: 'phoneFilm', film: { src: `${P}/film-pass.mp4`, poster: `${P}/film-pass-poster.jpg`, rate: 0.6 } },
  },
  {
    key: 'showcase', icon: Layout, kicker: 'Client Engagement', title: 'Showcases',
    line: 'A private home search for every buyer, and it runs itself.',
    steps: [{ icon: UserX, label: 'Guest has no agent' }, { icon: Sparkles, label: 'Showcase builds itself' }, { icon: Mail, label: 'Invite is emailed' }],
    why: ['Buyers like, pass, comment and request tours', 'New matches and price drops add themselves', 'The agent sees every reaction as it happens'],
    visual: { type: 'laptopFilm', film: { src: `${P}/film-showcase.mp4`, poster: `${P}/film-showcase-poster.jpg`, rate: 0.7 } },
  },
  {
    key: 'hub', icon: Link2, kicker: 'One Page', title: 'Agent Hub',
    line: 'One link with everything about the agent.',
    steps: [{ icon: Camera, label: 'Add photo and socials' }, { icon: LayoutList, label: 'Pick the sections' }, { icon: Share2, label: 'Share one link' }],
    why: ['Listings and sales update from the MLS on their own', 'Videos, house tours, blogs and reviews in one place', 'Save Contact, showings and lead forms built in'],
    visual: { type: 'phone', shot: { src: `${P}/hub.jpg`, w: 780, h: 3648 } },
  },
  {
    key: 'spotlight', icon: SpotlightIcon, kicker: 'Listing', ai: true, title: 'Listing Spotlight',
    line: 'A cinematic website for one listing, built in minutes.',
    steps: [{ icon: Home, label: 'Pick a listing' }, { icon: PenLine, label: 'AI writes the story' }, { icon: Rocket, label: 'Publish' }],
    why: ['Its own web address and QR code', 'Price, status and open houses stay in sync', 'Every tour request lands in Leads'],
    visual: { type: 'laptop', shot: { src: `${P}/spotlight.jpg`, w: 1400, h: 5484 } },
  },
  {
    key: 'media', icon: Clapperboard, kicker: 'Photo', ai: true, title: 'Media Lab',
    line: 'Turn the photos you have into the ones you want.',
    steps: [{ icon: ImagePlus, label: 'Pick a photo' }, { icon: SlidersHorizontal, label: 'Choose the edit' }, { icon: Sparkles, label: 'Generate' }],
    why: ['Day to twilight, lights on, virtual staging', 'Fix lawns, skies, clutter and lighting', 'No reshoot, no photographer, same day'],
    visual: { type: 'compare' },
  },
  {
    key: 'cine', icon: Film, kicker: 'Video', ai: true, title: 'Cinematic Video',
    line: 'Listing photos become a moving film, branded to the agent.',
    steps: [{ icon: Home, label: 'Pick the listing' }, { icon: ListChecks, label: 'Check each room' }, { icon: Film, label: 'Make the film' }],
    why: ['The real photos, moved by a 3D camera. Nothing made up', 'Room captions, music and the agent’s badge', 'Shapes for Reels, TikTok, square posts and YouTube'],
    visual: { type: 'screen', film: { src: `${P}/cinematic-windham.mp4`, poster: `${P}/cinematic-windham-poster.jpg` } },
  },
  {
    key: 'idx', icon: Globe, kicker: 'Auto-Built', title: 'IDX Website',
    line: 'A full home-search website, built for the agent.',
    steps: [{ icon: Sparkles, label: 'It builds itself' }, { icon: Brush, label: 'Pick a look' }, { icon: Rocket, label: 'Publish' }],
    why: ['Live MLS search with a map, and a page for every home', 'A guide for every town with live market data', 'Their own domain, found on Google, every inquiry into Leads'],
    visual: { type: 'laptop', shot: { src: `${P}/idx.jpg`, w: 1400, h: 4900 } },
  },
  {
    key: 'cma', icon: Calculator, kicker: 'Pricing', ai: true, title: 'CMA Builder',
    line: 'A client-ready pricing report in minutes.',
    steps: [{ icon: Home, label: 'Pick the home' }, { icon: ScanSearch, label: 'AI studies comps' }, { icon: Send, label: 'Share it' }],
    why: ['Reads each comp’s photos and data, and rates every one', 'A supported value, with a list or offer strategy', 'A branded web page and a print-ready PDF'],
    visual: { type: 'tablet', shot: { src: `${P}/cma.jpg`, w: 1000, h: 5278 } },
  },
  {
    key: 'studio', icon: Palette, kicker: 'Design', title: 'Studio',
    line: 'On-brand flyers, mailers and posts in a few clicks.',
    steps: [{ icon: MousePointerClick, label: 'Pick the moment' }, { icon: Home, label: 'Pick the home' }, { icon: Download, label: 'Download' }],
    why: ['The listing’s details and photos fill in by themselves', 'Flyers, postcards, door hangers, posts and Stories', 'A QR code on each piece tracks the leads it brings'],
    visual: { type: 'wall' },
  },
  {
    key: 'blogs', icon: Newspaper, kicker: 'Local SEO', ai: true, title: 'Blog Builder',
    line: 'Local articles that help buyers and sellers find the agent.',
    steps: [{ icon: MessagesSquare, label: 'A few questions' }, { icon: Search, label: 'AI writes it' }, { icon: ShieldCheck, label: 'It checks the facts' }],
    why: ['Written in the agent’s own voice', 'Can end with their sales or listings in that town', 'Shows on their Agent Hub and their website'],
    visual: { type: 'laptop', shot: { src: `${P}/blog.jpg`, w: 1400, h: 3675 } },
  },
  {
    key: 'forms', icon: ClipboardList, kicker: 'Capture Leads', title: 'Forms & Invites',
    line: 'A form or an invitation for every kind of lead.',
    steps: [{ icon: FileText, label: 'Pick a ready form' }, { icon: QrCode, label: 'Share link or QR' }, { icon: Inbox, label: 'Answers hit Leads' }],
    why: ['Nine ready-made forms, or build your own', 'Each mailer or ad gets its own tracking link', 'Event invitations with RSVPs and reminders'],
    visual: { type: 'phoneFilm', film: { src: `${P}/film-form.mp4`, poster: `${P}/film-form-poster.jpg`, rate: 0.6 } },
  },
]

// Shown after the Integrations slide (see PitchDeck SLIDES).
export const AI_FEATURE: Feature = {
  key: 'ai', icon: Bot, kicker: 'Built In', ai: true, title: 'AI Assistant',
  line: 'Ask how to do anything, or ask it to do it for you.',
  steps: [{ icon: MessagesSquare, label: 'Ask in plain words' }, { icon: Sparkles, label: 'It builds a card' }, { icon: CircleCheck, label: 'Tap to confirm' }],
  why: ['Makes designs, CMAs, Spotlights, Showcases and follow-ups', 'Knows every tool, so it doubles as live help', 'Nothing is saved or sent until the agent taps'],
  visual: { type: 'twoPhones', a: { src: `${P}/chat-ask.jpg`, w: 780, h: 1688 }, b: { src: `${P}/chat-made.jpg`, w: 780, h: 1688 } },
}

export const STACK = [
  'Open house sign-in app', 'Open house flyers', 'Lead capture forms', 'Follow-up reminders', 'Flyer and social designer',
  'AI photo editing and staging', 'Single-property websites', 'CMA software', 'Link-in-bio page', 'Email signature tool',
  'Review request tool', 'Blog writing tool',
]

export type Tile = { icon: Icon; title: string; line: string }
export const MORE: Tile[] = [
  { icon: Users, title: 'Leads', line: 'Every lead in one place, scored Hot to Cool' },
  { icon: BellRing, title: 'Follow-Ups', line: 'Reminders written for you. Tap to text' },
  { icon: MailOpen, title: 'Email Tracker', line: 'See who opened and who clicked' },
  { icon: Search, title: 'Discovery', line: 'Find open houses to host nearby' },
  { icon: Building2, title: 'Manager', line: 'Keep every listing hosted' },
  { icon: Star, title: 'Review Hub', line: 'One link. Posts to Google and Zillow' },
  { icon: Mail, title: 'Signature', line: 'An email signature that updates itself' },
  { icon: SwatchBook, title: 'Brand Kit', line: 'Colors, logos and fonts, set once' },
  { icon: TabletSmartphone, title: 'Kiosk Mode', line: 'Any tablet becomes a sign-in station' },
]

export const REASONS: Tile[] = [
  { icon: UserPlus, title: 'Recruit with a real toolkit', line: 'New agents get every tool on day one' },
  { icon: Handshake, title: 'Give agents a reason to stay', line: 'Your office becomes part of how they work' },
  { icon: Building2, title: 'More of your listings get hosted', line: 'Agents see your brokerage’s open houses first' },
  { icon: QrCode, title: 'A lead from every visitor', line: 'Every sign-in becomes a lead with a follow-up' },
  { icon: BadgeCheck, title: 'Your brokerage, on everything', line: 'Every kit, flyer and page comes out consistent' },
  { icon: ShieldCheck, title: 'Guardrails built in', line: 'AI writing flags Fair Housing risks' },
]

export const CRMS = ['Follow Up Boss', 'Lofty', 'kvCORE / BoldTrail', 'Sierra Interactive', 'Real Geeks', 'Wise Agent', 'LionDesk', 'Top Producer', 'Zapier']

export const OFFICE_STEPS = ['Tell us about your office', 'One price, one bill', 'We invite your agents', 'They’re ready to go']
export const PLANS = [
  { name: 'Basic', price: '$24.95' }, { name: 'Premium', price: '$49.95' }, { name: 'IDX', price: '$99.95' },
  { name: 'No-MLS Basic', price: '$19.95' }, { name: 'No-MLS Premium', price: '$49.95' },
]
export const DESIGNS = {
  a: ['p1', 's1', 'p4', 'f1', 'p7'], b: ['s2', 'p2', 'f2', 'p5', 's4'], c: ['p3', 'p6', 's3', 'p8'],
}

// What opens when someone clicks a result to look closer (components/pitch/PitchExpand.tsx). "live"
// tabs show Peter's real, working page inside the deck; every one also has a saved picture, so the
// deck still works with no internet. Sign-in, Guest Pass, Showcase and CMA are films / saved
// pictures only: their real links belong to one client or one open house.
export type ExpandTab =
  | { label: string; kind: 'sheet'; src: string; back?: string }
  | { label: string; kind: 'page'; device: 'phone' | 'desk'; src: string }
  | { label: string; kind: 'live'; device: 'phone' | 'desk'; url: string }
  | { label: string; kind: 'compare'; before: string; after: string; a: string; b: string }
  | { label: string; kind: 'video'; device?: 'phone' | 'desk'; src: string; poster?: string; sound?: boolean }
  | { label: string; kind: 'grid'; items: { thumb: string; full: string }[] }

const SITE = 'https://www.mainlinerealty.co'
export const EXPAND: Record<string, ExpandTab[]> = {
  kit: [
    { label: 'Sign-In Sheet', kind: 'sheet', src: `${P}/kit-flyer-lg.jpg` },
    { label: 'Cheat Sheet', kind: 'sheet', src: `${P}/kit-cheat-lg.jpg`, back: `${P}/kit-cheat-lg-2.jpg` },
    { label: 'Brag Sheet', kind: 'sheet', src: `${P}/kit-brag-lg.jpg`, back: `${P}/kit-brag-lg-2.jpg` },
    { label: 'Similar Homes', kind: 'sheet', src: `${P}/kit-similar-lg.jpg` },
  ],
  signin: [
    { label: 'Watch a guest sign in', kind: 'video', device: 'phone', src: `${P}/film-signin.mp4`, poster: `${P}/film-signin-poster.jpg` },
    { label: 'The sign-in sheet', kind: 'sheet', src: `${P}/kit-flyer-lg.jpg` },
  ],
  pass: [
    { label: 'Watch the Guest Pass', kind: 'video', device: 'phone', src: `${P}/film-pass.mp4`, poster: `${P}/film-pass-poster.jpg` },
    { label: 'Scroll it yourself', kind: 'page', device: 'phone', src: `${P}/pass.jpg` },
  ],
  showcase: [
    { label: 'Watch a buyer use it', kind: 'video', device: 'desk', src: `${P}/film-showcase.mp4`, poster: `${P}/film-showcase-poster.jpg` },
    { label: 'Scroll the Showcase', kind: 'page', device: 'desk', src: `${P}/showcase.jpg` },
    { label: 'The invite email', kind: 'page', device: 'phone', src: `${P}/showcase-email-full.jpg` },
  ],
  hub: [
    { label: 'Live page', kind: 'live', device: 'phone', url: `${SITE}/hub` },
    { label: 'Saved picture', kind: 'page', device: 'phone', src: `${P}/hub.jpg` },
  ],
  spotlight: [
    { label: 'Live site', kind: 'live', device: 'desk', url: 'https://239-windham-dr.openhousepal.com/' },
    { label: 'Saved picture', kind: 'page', device: 'desk', src: `${P}/spotlight.jpg` },
  ],
  media: [
    { label: 'Day to twilight', kind: 'compare', before: `${ML}/twilight-before.jpg`, after: `${ML}/twilight-after.jpg`, a: 'Day', b: 'Twilight' },
    { label: 'Virtual staging', kind: 'compare', before: `${ML}/staging-before.jpg`, after: `${ML}/staging-after.jpg`, a: 'Empty', b: 'Staged' },
  ],
  cine: [
    { label: '239 Windham Dr', kind: 'video', device: 'desk', src: `${P}/cinematic-windham.mp4`, poster: `${P}/cinematic-windham-poster.jpg`, sound: true },
  ],
  idx: [
    { label: 'Live site', kind: 'live', device: 'desk', url: `${SITE}/` },
    { label: 'Saved picture', kind: 'page', device: 'desk', src: `${P}/idx.jpg` },
    { label: 'Home search', kind: 'page', device: 'desk', src: `${P}/idx-search.jpg` },
  ],
  cma: [
    { label: 'The full report', kind: 'page', device: 'desk', src: `${P}/cma-report.jpg` },
    { label: 'The value', kind: 'page', device: 'desk', src: `${P}/cma-value.jpg` },
  ],
  studio: [
    { label: 'Designs', kind: 'grid', items: [...DESIGNS.a, ...DESIGNS.b, ...DESIGNS.c].map(d => ({ thumb: `${P}/design-${d}.jpg`, full: `${P}/design-${d}-lg.jpg` })) },
  ],
  blogs: [
    { label: 'Live blog', kind: 'live', device: 'desk', url: `${SITE}/peter-stefanatos/blogs` },
    { label: 'Saved picture', kind: 'page', device: 'desk', src: `${P}/blog.jpg` },
  ],
  forms: [
    { label: 'Watch a form filled in', kind: 'video', device: 'phone', src: `${P}/film-form.mp4`, poster: `${P}/film-form-poster.jpg` },
  ],
  ai: [
    { label: 'Ask it anything', kind: 'page', device: 'phone', src: `${P}/chat-ask.jpg` },
    { label: 'It made the post', kind: 'page', device: 'phone', src: `${P}/chat-made.jpg` },
  ],
}
