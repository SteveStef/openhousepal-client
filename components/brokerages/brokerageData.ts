import type { ComponentType } from 'react'
import {
  BadgeCheck, Bot, Building2, Calculator, CalendarClock, Clapperboard, ClipboardList, FileText, Globe, Handshake, Inbox, Layout,
  LayoutDashboard, Link2, Mail, MailCheck, Newspaper, Palette, PenLine, QrCode, Search, ShieldCheck, Sparkles, Star, UserPlus, Users,
} from 'lucide-react'
import { TOOL_PAGES } from '@/components/marketing/toolPagesData'

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>

// Which plans a tool is on comes from the Tools page's own data (toolPagesData), so this page can
// never say something different from /tools. "Included on X." -> "X".
function plansFor(slug: string): string {
  const line = TOOL_PAGES.find(t => t.slug === slug)?.plans || ''
  const first = line.split('.')[0].replace(/^Included on /, '')
  return first === 'every plan' ? 'Every plan' : first
}

export type BrokerFeature = { icon: Icon; title: string; text: string; plans: string; ai?: boolean }
export type BrokerPillar = { key: string; icon: Icon; name: string; line: string; features: BrokerFeature[] }

// Only what the product does today (owner: no made-up claims). Plan lines that aren't on /tools are
// features every paying plan has: Leads, follow-ups, Dash, the AI helper, AI writing, send-as.
export const PILLARS: BrokerPillar[] = [
  {
    key: 'open-houses', icon: QrCode, name: 'Open houses', line: 'Every open house runs itself, from the kit to the sign-in',
    features: [
      { icon: QrCode, title: 'QR sign-in', plans: plansFor('open-house-sign-in'), text: 'Visitors scan and sign in on their own phone, with no app. Every guest lands in the agent’s Leads.' },
      { icon: FileText, title: 'Open house kits', plans: plansFor('open-house-kits'), text: 'A Sign-In Sheet and Brag Sheet from one address, plus a Cheat Sheet and Similar Homes flyer on Bright MLS plans. The agent’s name and brokerage are already on them.' },
      { icon: Search, title: 'Discovery', plans: plansFor('discovery'), text: 'Agents find listings to host, starting with their own brokerage, and send the listing agent a request in a few taps.' },
      { icon: Building2, title: 'Open House Manager', plans: plansFor('open-house-manager'), text: 'Listing agents see which weekends still need a host, approve requests, leave host notes and see sign-in stats after.' },
    ],
  },
  {
    key: 'leads', icon: Inbox, name: 'Leads and follow-up', line: 'No visitor sits on paper, and nobody forgets to call back',
    features: [
      { icon: Inbox, title: 'One list of every lead', plans: 'Every plan', text: 'Sign-ins, form fills, tour requests and portal leads in one place, each tagged with where it came from.' },
      { icon: CalendarClock, title: 'Automatic follow-ups', plans: 'Every plan', text: 'Every open house guest gets a follow-up task the next morning, with a suggested message already written.' },
      { icon: Layout, title: 'Showcases', plans: plansFor('showcases'), text: 'A personal home search for each client. New matches arrive on their own, and agents see every like, comment and tour request.' },
      { icon: Link2, title: 'Calendar and CRM sync', plans: plansFor('calendar-crm-sync'), text: 'Google Calendar, plus Follow Up Boss, Lofty and kvCORE. Other CRMs connect by lead email, webhook or Zapier.' },
      { icon: MailCheck, title: 'Emails from their own inbox', plans: 'Every plan', text: 'Client emails can go out from the agent’s own Gmail or Outlook, and opens and clicks are tracked.' },
      { icon: ClipboardList, title: 'Branded forms', plans: plansFor('forms'), text: 'Seller onboarding, ads, mailers and more, shared by link or QR code, with every response in Leads.' },
    ],
  },
  {
    key: 'marketing', icon: Palette, name: 'Marketing', line: 'Polished, on-brand marketing without a designer',
    features: [
      { icon: Palette, title: 'Design Studio', plans: plansFor('studio'), text: 'Flyers, mailers and social posts that fill in the property details for you. “Just Sold” in a few clicks.' },
      { icon: Clapperboard, title: 'Media Lab', plans: plansFor('media-lab'), text: 'Twilight exteriors, virtual staging, lights-on shots and short videos from the photos they already have.', ai: true },
      { icon: Sparkles, title: 'Listing Spotlight', plans: plansFor('listing-spotlight'), text: 'A cinematic website for every listing, with its own address and QR code, kept in sync with the MLS.', ai: true },
      { icon: Newspaper, title: 'Blog Builder', plans: plansFor('blogs'), text: 'Researched, fact-checked local articles in the agent’s voice, from a few quick questions.', ai: true },
      { icon: Users, title: 'Agent Hub', plans: plansFor('agent-hub'), text: 'One link for everything about the agent: listings, sales, videos, reviews and a one-tap Save Contact card.' },
      { icon: Mail, title: 'Live email signature', plans: plansFor('email-signature'), text: 'A signature that rotates in a current listing or recent sale on its own, in Gmail and Outlook on the web.' },
      { icon: Star, title: 'Review Hub', plans: plansFor('review-hub'), text: 'One link for more Google and Zillow reviews, and an alert when a client leaves a low rating.' },
    ],
  },
  {
    key: 'selling', icon: Calculator, name: 'Pricing, websites and AI', line: 'The tools that win listings and keep agents fast',
    features: [
      { icon: Calculator, title: 'CMA reports', plans: plansFor('cma'), text: 'Branded CMAs with comps, market insights and supported pricing, as a PDF or a link the seller can open.', ai: true },
      { icon: Globe, title: 'IDX website', plans: plansFor('idx-website'), text: 'A complete website with full MLS search, a page for every home, town guides and every inquiry in Leads.' },
      { icon: LayoutDashboard, title: 'Dash', plans: 'Every plan', text: 'One screen with new leads, activity, open houses that need attention and Today’s Rundown.' },
      { icon: Bot, title: 'AI helper', plans: 'Every plan', text: 'Agents ask how to do anything, or have it set things up for them, right inside the app.', ai: true },
      { icon: PenLine, title: 'AI writing with a Fair Housing check', plans: 'Every plan', text: 'Drafts listing copy and bios, then flags phrases that could raise Fair Housing concerns and suggests a swap.', ai: true },
    ],
  },
]

export const FEATURE_COUNT = PILLARS.reduce((n, p) => n + p.features.length, 0)

// The kinds of tools agents often pay for one by one. General categories only: no competitor names,
// no competitor prices.
export const USUAL_STACK: { icon: Icon; label: string }[] = [
  { icon: QrCode, label: 'Open house sign-in app' },
  { icon: FileText, label: 'Open house flyers' },
  { icon: ClipboardList, label: 'Lead capture forms' },
  { icon: CalendarClock, label: 'Follow-up reminders' },
  { icon: Palette, label: 'Flyer and social designer' },
  { icon: Clapperboard, label: 'AI photo editing and staging' },
  { icon: Sparkles, label: 'Single-property websites' },
  { icon: Calculator, label: 'CMA software' },
  { icon: Users, label: 'Link-in-bio page' },
  { icon: Mail, label: 'Email signature tool' },
  { icon: Star, label: 'Review request tool' },
  { icon: Newspaper, label: 'Blog writing tool' },
  { icon: Globe, label: 'IDX website' },
]

export const REASONS: { icon: Icon; title: string; text: string }[] = [
  { icon: UserPlus, title: 'Recruit with a real toolkit', text: 'Offer new agents open house, lead and marketing tools on day one, instead of a list of apps to go buy.' },
  { icon: Handshake, title: 'Give agents a reason to stay', text: 'When the tools that run their business come from your office, your office becomes part of how they work every day.' },
  { icon: Building2, title: 'More of your listings get hosted', text: 'Discovery shows agents open houses to host starting with your own brokerage, and Manager keeps every weekend covered.' },
  { icon: QrCode, title: 'A lead from every visitor', text: 'Every sign-in becomes a lead with a next-morning follow-up, so open house traffic turns into business, not paper.' },
  { icon: BadgeCheck, title: 'Your brokerage, on everything', text: 'Kits carry the agent’s name and your brokerage, and every flyer, page and post comes out polished and consistent.' },
  { icon: ShieldCheck, title: 'Guardrails built in', text: 'AI writing flags Fair Housing risks, CMAs are labeled as market analysis, and client emails slow down for people who stop opening them.' },
]

export const OFFICE_STEPS: { title: string; text: string }[] = [
  { title: 'Tell us about your office', text: 'How many agents you have and which plan fits them best.' },
  { title: 'One price, one bill', text: 'We set up a single price for your office, monthly or on the schedule you pick, paid by card through PayPal’s secure form.' },
  { title: 'We invite your agents', text: 'Send us their emails. Each agent gets an invite and is on your plan as soon as they sign up.' },
  { title: 'They’re ready to go', text: 'A guided setup walks each agent through their brand, calendar and CRM, so they can run their next open house on it.' },
]

export const BROKER_FAQS: { q: string; a: string }[] = [
  { q: 'Can our brokerage pay for our agents?', a: 'Yes. We set up one price for your office and bill it in one place. Your agents join your plan when they sign up, so none of them has to enter a card.' },
  { q: 'Do you offer pricing for a whole office?', a: 'Yes. Tell us how many agents you have and which plan you want, and we will put together one price for your office. The standard per-agent prices are shown on this page.' },
  { q: 'What about agents who aren’t in Bright MLS?', a: 'They use the No-MLS plans: the same open house, lead and marketing tools, with listings and sales entered by hand.' },
  { q: 'How do Bright MLS agents get connected?', a: 'Each agent approves OpenHousePal in their Bright MLS account once, which takes about two minutes. Bright usually confirms within 24 to 48 hours, and we email the agent when it does.' },
  { q: 'Do agents keep their own brand?', a: 'Yes. Every agent has their own name, photo, colors and links, and your brokerage name appears on their open house kits.' },
  { q: 'Will it work with the CRM we already use?', a: 'Leads can be pushed to Follow Up Boss, Lofty or kvCORE, or to almost any other CRM by lead email, webhook or Zapier, with the lead source tagged.' },
  { q: 'Do visitors need to download anything?', a: 'No. Visitors scan a QR code and sign in on their own phone in seconds.' },
  { q: 'Is there a long contract?', a: 'Agent plans are month to month and can be cancelled anytime. Office arrangements are set up with you, on the schedule you choose.' },
]
