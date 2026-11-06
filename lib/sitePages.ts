// openhousepal.com's own pages, in one list: the burger menu, the top tabs, the page pills and the
// footer all read from here, so a new page shows up everywhere at once.
export const MARKETING_LINKS = [
  { href: '/tools', label: 'All Tools' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/idx-websites', label: 'IDX Websites' },
  { href: '/resources', label: 'Resources' },
  { href: '/brokerages', label: 'For Brokerages' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
]

/** The homepage. Signed in, plain `/` goes to the dashboard, so they get the address that stays put. */
export const homeHref = (signedIn: boolean) => (signedIn ? '/?view=marketing' : '/')
