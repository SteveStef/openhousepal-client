// The setup flow's words - one plain-language card per step, written for someone who has never
// used a website builder. `powers` lists what the answer turns on for THIS plan; `skip` says, in
// one sentence, what they go without. The backend (setup_flow_service.py) decides which steps a
// plan gets and whether each is done; this file only says them nicely.
import {
  AtSign, BadgeCheck, Bell, BookOpen, CalendarDays, Camera, ClipboardList, DoorOpen, Globe, Home, LayoutTemplate, Mail, MailCheck, MapPin,
  Palette, Phone, PlugZap, Star, UserRound, type LucideIcon,
} from 'lucide-react'
import type { SetupStepId } from '@/lib/api-service'
import { hasAgentHubAccess, hasEmailSignatureAccess, hasMlsAccess, hasShowcaseAccess, hasStudioDesignAccess } from '@/lib/navAccess'
const hasShowcase = (plan: string | null) => hasShowcaseAccess(plan || undefined)

export type StepCopy = {
  icon: LucideIcon
  /** short name for the step list */
  label: string
  /** the big title; the part in <em> is set in gold */
  title: [string, string]
  intro: string
  powers: string[]
  skip?: string
}

export function stepCopy(id: SetupStepId, plan: string | null, hasMls: boolean): StepCopy {
  const hub = hasAgentHubAccess(plan || undefined)
  const sig = hasEmailSignatureAccess(plan || undefined)
  const mls = plan ? hasMlsAccess(plan) : hasMls
  const studio = hasStudioDesignAccess(plan || undefined)
  const idx = plan === 'IDX'
  const where = (base: string[], extra: [boolean, string][]) => [...base, ...extra.filter(([on]) => on).map(([, s]) => s)]

  switch (id) {
    case 'about':
      return {
        icon: UserRound, label: 'About you', title: ['Let’s start with ', 'you'],
        intro: 'Your name and where you work. We filled in what you gave us when you signed up - just check it and add anything missing.',
        powers: where(['Sign-in sheets', 'Forms', 'Emails to your guests'], [[mls, 'CMA reports'], [hub, 'Agent Hub'], [sig, 'Email signature'], [idx, 'Website & Spotlights']]),
      }
    case 'contact':
      return {
        icon: Phone, label: 'How to reach you', title: ['How should clients ', 'reach you?'],
        intro: 'The numbers and email your clients tap to call, text or write to you.',
        powers: where(['Call & text buttons on your forms', 'Emails to your guests'], [[hub, 'Agent Hub + Save Contact card'], [sig, 'Email signature'], [mls, 'CMA reports'], [idx, 'Website & Spotlights']]),
      }
    case 'license':
      return {
        icon: BadgeCheck, label: 'License number', title: ['Your real estate ', 'license'],
        intro: 'Type it once. After it’s saved it locks, so it always matches your MLS record.',
        powers: where([], [[mls && hub, 'Finding your closed sales'], [idx, 'Shown on your website as required'], [!idx, 'Kept on file - never shown to the public']]),
      }
    case 'photo':
      return {
        icon: Camera, label: 'Your photo', title: ['Add your ', 'photo'],
        intro: 'A friendly headshot. People are far more likely to reach out when they can see who they’re talking to.',
        powers: where(['Sign-in pages', 'Forms', 'Emails to your guests'], [[mls, 'CMA reports'], [hub, 'Agent Hub'], [sig, 'Email signature'], [idx, 'Website']]),
        skip: 'Visitors see your initials instead of your face.',
      }
    case 'story':
      return {
        icon: BookOpen, label: 'Your story', title: ['Tell them your ', 'story'],
        intro: 'A few friendly sentences about you - how long you’ve been helping people, the areas you love, what makes you different.',
        powers: where(['Agent Hub "About me"'], [[idx, 'Website About page'], [idx, 'Listing Spotlights']]),
        skip: 'Your "About me" sections stay hidden.',
      }
    case 'socials':
      return {
        icon: AtSign, label: 'Your socials', title: ['Your ', 'social pages'],
        intro: 'Paste the link to any page you use. Leave the rest empty - only the ones you fill in will show.',
        powers: where(['Agent Hub icons', 'Save Contact card'], [[sig, 'Email signature'], [idx, 'Website footer']]),
        skip: 'No social icons appear on your pages.',
      }
    case 'sales':
      return {
        icon: Home, label: 'Your sales', title: ['Show off your ', 'sales'],
        intro: mls ? 'We look up the homes you’ve sold for you. Take a quick look and hide anything you don’t want shown.' : 'Add a few homes you’ve sold - an address, the price and a photo is plenty.',
        powers: where(['Agent Hub "Recent Sales"', 'Sales stats'], [[sig, 'Email signature'], [idx, 'Website']]),
        skip: 'Your Sales section stays empty.',
      }
    case 'reviews':
      return {
        icon: Star, label: 'Reviews', title: ['Turn happy clients into ', 'reviews'],
        intro: 'When a client gives you 4 or 5 stars, we send them straight to your Google or Zillow page to post it there too.',
        powers: ['Your review link', 'Reviews on your Agent Hub', idx ? 'Testimonials on your website' : ''].filter(Boolean),
        skip: 'Great reviews stay on OpenHousePal only - they never reach Google or Zillow.',
      }
    case 'brand':
      return {
        icon: Palette, label: 'Your brand', title: ['Your ', 'logo & colors'],
        intro: 'Your logo and brand colors, so everything we make for you looks like you.',
        powers: where([], [[mls, 'CMA reports'], [true, 'Net sheets'], [studio, 'Designs & blogs'], [idx, 'Website & Spotlights']]),
        skip: 'Your brokerage name shows as plain text and we use our standard colors.',
      }
    case 'hub':
      return {
        icon: LayoutTemplate, label: 'Agent Hub', title: ['Your ', 'Agent Hub'],
        intro: 'Your Agent Hub is the one link that has everything about you. Pick its look and what’s on it - you can change it anytime.',
        powers: ['Your Agent Hub page', 'Your Sales page'],
        skip: 'Your hub wears your Brand Kit, with everything switched on.',
      }
    case 'forms':
      return {
        icon: ClipboardList, label: 'Your forms', title: ['Your ', 'forms'],
        intro: 'Your forms are what people fill out when they want your help. Give them your Brand Kit or a look of their own, and choose how every form behaves.',
        powers: ["What's My Home Worth", "I'm Buying & I'm Selling", 'Every form you share'],
        skip: 'Your forms wear your Brand Kit.',
      }
    case 'signature':
      return {
        icon: Mail, label: 'Email signature', title: ['Your ', 'email signature'],
        intro: 'A beautiful signature for the bottom of every email you send, with your photo, your listings and buttons clients can tap.',
        powers: ['Every email you send', 'Updates itself when you list or sell'],
        skip: 'Your emails go out without your signature card.',
      }
    case 'openhouse':
      return {
        icon: DoorOpen, label: 'Open house defaults', title: ['Your open house ', 'defaults'],
        intro: hasShowcase(plan)
          ? 'How every new open house kit starts, and what guests get after they sign in. You can still change any open house on its own.'
          : 'How every new open house kit starts. You can still change any open house on its own.',
        powers: where(['Every new open house kit'], [[hasShowcase(plan), 'Showcases for guests without an agent']]),
        skip: hasShowcase(plan) ? 'Kits start with our standard choices, and guests without an agent get their Showcase about an hour after they sign in.' : 'Kits start with our standard choices.',
      }
    case 'alerts':
      return {
        icon: Bell, label: 'Alerts & follow-ups', title: ['How should we ', 'tell you?'],
        intro: 'Pick the emails you want from us, and whether OpenHousePal reminds you who to follow up with.',
        powers: ['New lead alerts', 'Follow-ups', 'Daily briefing'],
        skip: 'You get our standard emails, and Follow-ups stay on.',
      }
    case 'calendar':
      return {
        icon: CalendarDays, label: 'Calendar', title: ['Connect your ', 'calendar'],
        intro: 'Follow-ups, open houses and showings appear right on the calendar on your phone.',
        powers: ['Follow-up reminders on your phone', 'Open houses & showings'],
        skip: 'Reminders only show up when you open OpenHousePal.',
      }
    case 'mailbox':
      return {
        icon: MailCheck, label: 'Your email', title: ['Send from ', 'your own email'],
        intro: 'Connect Gmail and your client emails come from your real address, so they land in the inbox and show in your Sent folder. Turn it off any time and OpenHousePal sends them for you.',
        powers: where(['Tour confirmations'], [[hasShowcase(plan), 'Showcase invites & new-home updates'], [idx, 'Listing alerts']]),
        skip: 'Guest emails come from OpenHousePal, and some may land in junk.',
      }
    case 'crm':
      return {
        icon: PlugZap, label: 'Your CRM', title: ['Send leads to your ', 'CRM'],
        intro: 'Already use Follow Up Boss or another CRM? We’ll send every new lead there automatically. No CRM? Just skip this.',
        powers: ['Every new lead, sent to your CRM'],
        skip: 'New leads stay in OpenHousePal only.',
      }
    case 'areas':
      return idx ? {
        icon: MapPin, label: 'Towns you serve', title: ['The towns ', 'you serve'],
        intro: 'Add the towns you work in. These become the neighborhoods on your website - each one gets its own page with local market numbers. You can change them any time in your website editor.',
        powers: ['Neighborhoods on your website', 'Town pages', 'Area market trends'],
        skip: 'Your website has no neighborhood pages.',
      } : {
        icon: MapPin, label: 'Towns you serve', title: ['The towns ', 'you serve'],
        intro: 'Add the towns you work in. We use them to suggest the right homes on your forms and match buyers to your towns' + (studio ? ', and for town cards in your blog articles.' : '.') + ' (With the IDX plan, these also become the neighborhoods on your website.)',
        powers: where(['Your forms', 'Matching buyers to towns'], [[studio, 'Blog town cards']]),
        skip: 'Forms suggest homes from anywhere in the MLS.',
      }
    case 'homes':
      return {
        icon: Home, label: 'Website homes', title: ['The homes your ', 'website shows'],
        intro: 'The top of your website always shows the newest homes for sale in your towns. Tap the towns and price range - and choose what your Featured page shows.',
        powers: ['Your home page header', 'Your Featured page'],
        skip: 'Your website shows the newest homes in all your towns, any price.',
      }
    case 'website':
      return {
        icon: Globe, label: 'Your website', title: ['Turn on your ', 'website'],
        intro: 'Pick a look and put your website live. Everything you filled in above is already on it.',
        powers: ['Your IDX website', 'Home search for your clients'],
        skip: 'Your website stays offline - nobody can see it yet.',
      }
    case 'domain':
      return {
        icon: AtSign, label: 'Web address', title: ['Your ', 'web address'],
        intro: 'Keep your free address, use a domain you already own, or get a new one right here - we set it all up for you.',
        powers: ['Your website address', 'QR codes & links', 'Email signature'],
        skip: 'Your website keeps its free OpenHousePal address.',
      }
  }
}
