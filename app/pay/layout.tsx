import type { Metadata } from 'next'

// Payment links are private to the person they were sent to - never listed by Google.
export const metadata: Metadata = { title: 'Payment | OpenHousePal', robots: { index: false, follow: false } }

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children
}
