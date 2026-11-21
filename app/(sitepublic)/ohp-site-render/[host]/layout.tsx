import type { Metadata } from 'next'

// An agent's own website must never wear OpenHousePal's marketing tags. Every real page sets its
// own title, description, canonical and share card (page.tsx generateMetadata), but a page that
// isn't there (a sold home's old link, a typo) renders not-found with only the layouts' tags - and
// the root layout's are OpenHousePal's homepage ("Real Estate Agent Software ... | OpenHousePal",
// canonical https://openhousepal.com) - seen on www.mainlinerealty.co/testimonials, audit 11/21.
export const metadata: Metadata = {
  title: 'Page not found',
  description: null,
  applicationName: null,
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
}

export default function AgentSiteLayout({ children }: { children: React.ReactNode }) {
  return children
}
