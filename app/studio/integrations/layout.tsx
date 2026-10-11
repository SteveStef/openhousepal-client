import type { Metadata } from 'next'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Integrations | OpenHousePal' }

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
