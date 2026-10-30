import type { Metadata } from 'next'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Activity | OpenHousePal' }

// A Bright agent still waiting on approval goes to the waiting page, like Leads / Open Houses.
export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <BrokerAuthorizationGuard>{children}</BrokerAuthorizationGuard>
}
