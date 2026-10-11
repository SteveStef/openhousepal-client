import type { Metadata } from 'next'

// Personal to one guest (their details are pre-filled) - never indexed.
export const metadata: Metadata = {
  title: 'Your Guest Pass',
  robots: { index: false, follow: false },
}

export default function GuestPassLayout({ children }: { children: React.ReactNode }) {
  return children
}
