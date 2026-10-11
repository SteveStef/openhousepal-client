import { QrCode, ClipboardList, Calculator, Search, Building2, Globe, Layout, Palette, Newspaper, Link2, Clapperboard, CalendarClock, Star, Mail } from 'lucide-react'
import { SpotlightIcon, KitsIcon } from '@/components/icons/CustomIcons'
import SignInDemo from './demos/SignInDemo'
import OpenHouseKitDemo from './demos/OpenHouseKitDemo'
import EmailSignatureDemo from './demos/EmailSignatureDemo'
import FormsDemo from './demos/FormsDemo'
import CmaDemo from './demos/CmaDemo'
import DiscoveryDemo from './demos/DiscoveryDemo'
import ManagerDemo from './demos/ManagerDemo'
import AgentHubDemo from './demos/AgentHubDemo'
import ShowcaseDemo from './demos/ShowcaseDemo'
import DesignStudioDemo from './demos/DesignStudioDemo'
import BlogsDemo from './demos/BlogsDemo'
import IdxWebsiteDemo from './demos/IdxWebsiteDemo'
import AiMediaDemo from './demos/AiMediaDemo'
import ListingPageDemo from './demos/ListingPageDemo'
import ReviewsDemo from './demos/ReviewsDemo'
import CalendarSyncDemo from './demos/CalendarSyncDemo'

// Shared by the hero's live feature explorer (app/page.tsx). Icons/labels match
// components/pricing/PricingCards.tsx so the vocabulary is identical between "what you get"
// (pricing) and "how it works" (here), and the order mirrors the plan cards: Basic's features
// first, then Premium's, then IDX's.
export const FEATURE_TABS = [
  { key: 'signin', label: 'Sign In', icon: QrCode, blurb: "Visitors scan your branded QR code and sign in on their phone in seconds — no app required. If they don't have an agent, OpenHousePal automatically creates a personalized Showcase based on similar listings and invites them to it after the open house.", Demo: SignInDemo },
  { key: 'signature', label: 'Signature', icon: Mail, blurb: 'A mini Agent Hub at the bottom of every email you send — your active listing or a recent sale rotates in automatically, so it stays current without ever re-pasting it into Gmail or Outlook. Your Signature also carries through the many other OpenHousePal tools.', Demo: EmailSignatureDemo },
  { key: 'forms', label: 'Forms', icon: ClipboardList, blurb: 'Create branded forms for any situation — seller onboarding, Facebook leads, website funnels, mailers, open houses, and more. Customize the questions, then share one link or its QR code — scan it and the form opens right up — and every response flows straight into your Leads.', Demo: FormsDemo },
  { key: 'cma', label: 'CMA', icon: Calculator, blurb: 'Instantly generate comprehensive CMA reports with comp analysis, market insights, supported pricing, and a polished client-ready presentation — branded to you, downloadable as a PDF for printing, and shareable as its own viewable web page. (A CMA is a market analysis, not a formal appraisal.)', Demo: CmaDemo },
  { key: 'discovery', label: 'Discovery', icon: Search, blurb: "Pull listings from your brokerage that match what you're looking to host, filter down to the best fits, and send the listing agent a hosting request in a couple of taps — approvals, declines, and counter-offers all tracked in one place.", Demo: DiscoveryDemo },
  { key: 'manager', label: 'Manager', icon: Building2, blurb: 'Manage open house hosting for all your listings from one board — see which weekends still need a host, approve or decline agent requests, assign a host with private notes, and review guest counts and sign-in stats after each one.', Demo: ManagerDemo },
  { key: 'design', label: 'Studio', icon: Palette, blurb: 'Create polished, on-brand flyers, mailers, and social posts that auto-fill the property details in any of our designer styles — ready to download and post in seconds. Create "Just Sold" posts or "Looking to Sell" mailers in just a few clicks!', Demo: DesignStudioDemo },
  { key: 'aimedia', label: 'Media Lab', icon: Clapperboard, blurb: 'Turn the listing photos you already have into twilight exteriors, virtually staged rooms, lights-on shots, and short walkthrough videos — no reshoot, no photographer, ready to post the same day.', Demo: AiMediaDemo },
  { key: 'blogs', label: 'Blogs', icon: Newspaper, blurb: "Answer a few quick questions and Blog Builder researches your towns, writes a complete, SEO-ready article in your voice, and fact-checks every number before you publish — ending with your sales or listings in that area. Local guides that help buyers and sellers find you first.", Demo: BlogsDemo },
  { key: 'listingpage', label: 'Spotlight', icon: SpotlightIcon, blurb: "Pick a listing and our AI builds it a cinematic website of its own in minutes — every photo and MLS detail, the standout features, a polished story, a room-by-room tour, and a guide to the town, on its own address with a QR code. Price, status, and open houses stay synced live, and every tour request lands in your Leads.", Demo: ListingPageDemo },
  { key: 'calsync', label: 'Cal + CRM', icon: CalendarClock, blurb: 'Connect Google or Microsoft/Outlook Calendar and the CRM you already use once — open houses, follow-up reminders, and confirmed tours land on your calendar automatically, and every new lead is pushed to your CRM with its source tagged.', Demo: CalendarSyncDemo },
  { key: 'reviews', label: 'Review Hub', icon: Star, blurb: 'One review link that sends your happiest clients straight to Google and Zillow with their review pre-copied, keeps anything under four stars private as a heads-up to you, and shows your best reviews on your Agent Hub.', Demo: ReviewsDemo },
  // In the tools grid (see app/page.tsx): agenthub + showcase + kits render as a row of three
  // half-width upgraded cards directly above the IDX bar, so the grid builds up to a visual
  // climax (small tiles -> the three "hub" cards -> the full-width IDX flagship) instead of
  // burying any of them mid-grid.
  { key: 'agenthub', label: 'Agent Hub', icon: Link2, blurb: "Your branded one-page hub for socials, sales, listings, videos & blogs - with a one-tap Save Contact card so clients keep your number. It updates itself as your Bright MLS listings & sales change.", Demo: AgentHubDemo },
  { key: 'showcase', label: 'Showcases', icon: Layout, blurb: 'A living, personalized home-search hub you build for a client — they like, dislike, and comment on homes and request tours right from it, new matching listings are added automatically, and you see every reaction as it happens. One is even created for you automatically whenever someone signs into an open house without an agent, seeded with listings similar to that property.', Demo: ShowcaseDemo },
  { key: 'kits', label: 'Kits', icon: KitsIcon, blurb: 'Enter an address and instantly create a Sign-In Sheet, Cheat Sheet, Brag Sheet, and Similar Homes flyer — each branded to you with its own scannable QR code, ready to print and share.', Demo: OpenHouseKitDemo },
  { key: 'idx', label: 'IDX', icon: Globe, blurb: 'A complete IDX website, built for you and branded to you — full MLS search with a map, your featured and newly listed homes, a page for every home, neighborhood guides with live market data and side-by-side town comparisons, your sales and blogs, Showcases visitors build themselves, and every inquiry straight into your Leads. On your own domain, found on Google.', Demo: IdxWebsiteDemo },
] as const

export type FeatureTabKey = typeof FEATURE_TABS[number]['key']
