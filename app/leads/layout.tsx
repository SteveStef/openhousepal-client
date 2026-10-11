import type { Metadata } from 'next'
import SignedInOnly from '@/components/auth/SignedInOnly'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Leads | OpenHousePal' }

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <SignedInOnly>{children}</SignedInOnly>
}
