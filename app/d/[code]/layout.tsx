import type { Metadata } from 'next'

// One person's "mark as done" link from a calendar event - never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function DoneLinkLayout({ children }: { children: React.ReactNode }) {
  return children
}
