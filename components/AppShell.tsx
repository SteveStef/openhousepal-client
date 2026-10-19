'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import AppHeader from '@/components/AppHeader'
import PageGate from '@/components/PageGate'
import NavHistoryTracker from '@/components/NavHistoryTracker'
import AssistantWidget from '@/components/assistant/AssistantWidget'
import IdxDomainMigrationModal from '@/components/IdxDomainMigrationModal'

// Everything only the OpenHousePal app needs around a page (sign-in state, toasts, the header, the
// page loader, the assistant). The root layout loads this lazily and only on app pages, so an
// agent's IDX website never downloads any of it (10/19 sweep - it was ~160 KB on every IDX page).
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <main className="min-h-screen flex flex-col overflow-x-clip overflow-y-visible">
          {/* No wrapping div here - Header.tsx's own <header> already carries print:hidden,
              and a sticky element can never stick past the bottom edge of its own
              containing block. A wrapper sized to exactly the header's own height gave it
              zero room to actually stick; as a direct child of this full-page-height
              <main>, it now has the whole page to stay pinned across. */}
          <NavHistoryTracker />
          <AppHeader />
          {/* App pages wait behind the logo loader until they're fully loaded, then rise in. */}
          <PageGate>{children}</PageGate>
        </main>
        <AssistantWidget />
        <IdxDomainMigrationModal />
      </AuthProvider>
    </ToastProvider>
  )
}
