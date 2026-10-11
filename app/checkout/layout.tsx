import type { Metadata } from 'next'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Checkout | OpenHousePal' }

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
