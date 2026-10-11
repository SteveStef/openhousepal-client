import type { Metadata } from 'next'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Email Signature | OpenHousePal' }

export default function EmailSignatureLayout({ children }: { children: React.ReactNode }) {
  return children
}
