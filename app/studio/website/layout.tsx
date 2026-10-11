import type { Metadata } from 'next'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'IDX Website | OpenHousePal' }

export default function IdxWebsiteLayout({ children }: { children: React.ReactNode }) {
  return children
}
