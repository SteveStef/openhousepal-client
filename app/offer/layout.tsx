import type { Metadata } from 'next'

// Offer links are private to the people they're shown to - never listed by Google.
export const metadata: Metadata = { title: 'Your OpenHousePal offer', robots: { index: false, follow: false } }

export default function OfferLayout({ children }: { children: React.ReactNode }) {
  return children
}
