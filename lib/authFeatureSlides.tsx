import type { ReactNode } from 'react'
import { Home, ClipboardList, Calculator, Search, Globe, Link2, Layout, Palette, Newspaper, Users, Sparkles, Building2, CalendarClock, Star } from 'lucide-react'

// One card per feature "mini-card" on the homepage plan cards (components/pricing/PricingCards.tsx)
// - every SpotlightFeatureCard across Basic / Premium / IDX / No-MLS / No-MLS Premium. Rendered in
// the cycling right-hand panel on BOTH the sign-in and create-account screens, so it lives here
// once. Keep in sync with the pricing cards (this is marketing copy, not the plan-contents
// contract).
export interface AuthFeatureSlide {
  kicker: string
  title: string
  description: string
  icon: ReactNode
}

const cls = 'w-6 h-6 text-white'

export const AUTH_FEATURE_SLIDES: AuthFeatureSlide[] = [
  { kicker: 'Automated', title: 'Open House Kits & Sign-In', description: 'Instantly generates a QR code sign-in sheet, Brag Sheet, Similar Properties flyer, and Cheat Sheet for your open house.', icon: <Home className={cls} strokeWidth={2.5} /> },
  { kicker: 'Capture Leads', title: 'Forms', description: 'Build lead forms, launch campaigns, and track every response.', icon: <ClipboardList className={cls} strokeWidth={2.5} /> },
  { kicker: 'Pricing', title: 'CMA Builder', description: 'AI deep-dives listing facts & photos, then builds a detailed, pro-grade report.', icon: <Calculator className={cls} strokeWidth={2.5} /> },
  { kicker: 'Open House Tools', title: 'Discovery + Manager', description: 'Find and request to host open houses, manage hosting on your own listings, and track performance.', icon: <Search className={cls} strokeWidth={2.5} /> },
  { kicker: 'Track & Convert', title: 'Leads', description: 'Every sign-in and inquiry captured and organized in one place.', icon: <Users className={cls} strokeWidth={2.5} /> },
  { kicker: 'Two-Way Sync', title: 'Calendar & CRM Sync', description: 'Open houses and follow-ups flow to your Google Calendar; new leads push straight to your CRM.', icon: <CalendarClock className={cls} strokeWidth={2.5} /> },
  { kicker: 'One Page', title: 'Agent Hub', description: 'Your branded one-page hub for socials, sales, listings, videos, and blogs.', icon: <Link2 className={cls} strokeWidth={2.5} /> },
  { kicker: 'Client Engagement', title: 'Showcases', description: 'A shared home-search hub clients react to, comment on, and request tours from - with new matches added automatically.', icon: <Layout className={cls} strokeWidth={2.5} /> },
  { kicker: 'Design', title: 'Studio', description: 'Polished flyers, mailers, and social posts, auto-filled from your listing and ready to use.', icon: <Palette className={cls} strokeWidth={2.5} /> },
  { kicker: 'Photo & Video', title: 'Media Lab', description: 'Twilight, staging & photo-to-video, plus an easy editor for stunning animated social posts.', icon: <Sparkles className={cls} strokeWidth={2.5} /> },
  { kicker: 'Reputation', title: 'Review Hub', description: 'A one-tap review link that sends happy clients to Google and Zillow and keeps low ratings private.', icon: <Star className={cls} strokeWidth={2.5} /> },
  { kicker: 'Local SEO', title: 'Blogs', description: 'Publish market updates and local content to build your authority & SEO in minutes.', icon: <Newspaper className={cls} strokeWidth={2.5} /> },
  { kicker: 'Listing', title: 'Spotlight', description: 'A cinematic standalone site for each of your listings - set up for you by AI in minutes.', icon: <Building2 className={cls} strokeWidth={2.5} /> },
  { kicker: 'Full Website', title: 'IDX Website', description: 'A complete, branded IDX website with automatic listing sync, full property search, and client reviews shown right on the site.', icon: <Globe className={cls} strokeWidth={2.5} /> },
  { kicker: 'Your Own Brand', title: 'Custom Domain Support', description: 'Connect your own domain and bring your IDX website, Agent Hub, Showcases, Spotlights, Forms, Kits, Review Hub, blogs & more under it.', icon: <Globe className={cls} strokeWidth={2.5} /> },
]
