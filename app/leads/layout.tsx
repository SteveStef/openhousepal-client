import type { Metadata } from 'next'
import SignedInOnly from '@/components/auth/SignedInOnly'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Leads | OpenHousePal' }

// A Bright agent still waiting on approval goes to the waiting page, like Open Houses / Showcases.
export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <SignedInOnly><BrokerAuthorizationGuard>{children}</BrokerAuthorizationGuard></SignedInOnly>
}
