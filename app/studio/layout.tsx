import type { Metadata } from 'next'
import SignedInOnly from '@/components/auth/SignedInOnly'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'Tools | OpenHousePal' }

// A Bright agent still waiting on approval goes to the waiting page (every tool needs a plan). The
// export browser behind /print has no session, so the guard lets it through.
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <SignedInOnly><BrokerAuthorizationGuard>{children}</BrokerAuthorizationGuard></SignedInOnly>
}
